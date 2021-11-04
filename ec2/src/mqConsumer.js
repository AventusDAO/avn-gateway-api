// This script is started by executing command `/ec2/src$ node mq-consumer-test.js`
// It keeps pulling messages from a message queue synchronously, and try to reconnect if a connection is closed or failed be established.
// It receives a number of messages specified in the configuration file, then prints out each message as `Sent request [message]`,
// and finally acknowledges the queue to delete the message.

'use strict'

const amqp = require('amqplib/callback_api')
const avn = require('./avn')
const config = require('multiconfig').load()
const logger = require('log4js').configure(config.log4Js).getLogger()
const SecretsManager = require('./secretsManager')

async function connectToMQ() {
  let mqConsumer = new MQConsumer(
    config.mq.secretManagerRegion,
    config.mq.mqSecretArn,
    config.mq.mqBrokerAmqpEndpoint,
    config.mq.components
  )
  await mqConsumer.processMessagesFromMq()
}

function MQConsumer(secretsManagerRegion, secretArn, mqBrokerAmqpEndpoint, mqComponents) {
  this.secretsManager = new SecretsManager(secretsManagerRegion, logger)
  this.secretArn = secretArn
  this.mqBrokerAmqpEndpoint = mqBrokerAmqpEndpoint
  this.mqComponents = mqComponents
}

MQConsumer.prototype.getMqConnectionUrl = async function() {
  const secret = await this.secretsManager.getSecret(this.secretArn)
  return this.mqBrokerAmqpEndpoint.replace('amqps://', `amqps://${encodeURIComponent(secret.username)}:${encodeURIComponent(secret.password)}@`)
}

MQConsumer.prototype.processMessagesFromMq = async function() {
  const self = this;
  amqp.connect(await this.getMqConnectionUrl(), function(err, conn) {
    logger.info('[AMQP] connecting')

    if (err) {
      logger.error('[AMQP] connect error', err.message)
      return setTimeout(self.processMessagesFromMq, 1000)
    }

    conn.on('error', function(err) {
      if (err.message !== '[AMQP] connection closing') {
        logger.error('[AMQP] connection error', err.message)
      }
    })

    conn.on('close', function() {
      logger.error('[AMQP] reconnecting')
      return setTimeout(self.processMessagesFromMq, 1000)
    })

    logger.info('[AMQP] connected')

    whenConnected(conn, self.mqComponents)
  })
}

async function whenConnected(conn, components) {
  const amqpChannel = await createChannel(conn)

  assertMqComponents(amqpChannel, components)
  logger.info('[AMQP] elements are ready')

  const { avnTxQueue } = components

  logger.info('MQ message processor has started')
  while(true) {
    await processMessage(amqpChannel, avnTxQueue).catch((_err) => {})
  }
}

async function assertMqComponents(channel, components) {
  const {avnTxQueue, deadLetterQueue, deadLetterExchange, deadLetterKey} = components

  channel.assertExchange(deadLetterExchange, 'direct')
  channel.assertQueue(avnTxQueue, {
    durable: true,
    deadLetterExchange: deadLetterExchange,
    deadLetterRoutingKey: deadLetterKey
  })
  channel.assertQueue(deadLetterQueue, { durable: true })
  channel.bindQueue(deadLetterQueue, deadLetterExchange, deadLetterKey)
}

async function processMessage(channel, queue) {
  const allUpTo = false // Just this message
  const requeue = false // Drop to dead letter queue

  await new Promise((resolve, reject) => {
    channel.get(queue, {
      noAck: false
    }, async function(err, message) {
      if (err) {
        channel.nack(message, allUpTo, requeue)
        reject()
      } else if (!message) {
        resolve() /* empty queue */
      } else {
        try {
          await trySendAvnTx(message)
          channel.ack(message)
          resolve()
        } catch (err) {
          channel.nack(message, allUpTo, requeue)
          reject()
        }
      }
    })
  })
}

function createChannel(conn) {
  return new Promise((resolve, reject) => {
    conn.createChannel(function(err, channel) {
      if (err) {
        logger.error('[AMQP] channel connection error', err.message)
        throw err
      }

      channel.on('error', function(err) {
        logger.error('[AMQP] channel error', err.message)
      })
  
      channel.on('close', function() {
        logger.info('[AMQP] channel closed')
        reject()
      })

      logger.info('[AMQP] channel created')

      resolve(channel)
    })
  })
}

async function trySendAvnTx(message) {
  const {avnTxRetryCount, avnTxRetryDelay} = config.mq.components
  let retries = 0

  while (retries <= avnTxRetryCount) {
    try {
      return await sendAvnTx(JSON.parse(message.content.toString()))
    } catch (err) {
      retries++

      if (retries <= avnTxRetryCount) {
        logger.trace(`sendAvnTx failed ${retries} time(s), retrying again. Error: ${err.message}`)
        await new Promise(resolve => setTimeout(resolve, avnTxRetryDelay))
      } else {
        logger.error('sendAvnTx err', err.message)
        throw err
      }
    }
  }
}

async function sendAvnTx(request) {
  logger.trace(`Request body: ${JSON.stringify(request)}`)
  const { requestId, txType, palletName, method, params } = request

  switch(txType) {
    case 'avnTx':
      const result = await avn.tx(palletName, method, params)
      logger.info(`Request sent with ID: ${result.requestId} and received result: ${JSON.stringify(result)}`)
      break
    case 'avnProxy':
      const result = await avn.proxy(palletName, method, params)
      logger.info(`Proxy request sent with ID: ${result.requestId}`)
      break
    default:
      throw Error('Transaction type not supported')
  }
}

module.exports = { connectToMQ }