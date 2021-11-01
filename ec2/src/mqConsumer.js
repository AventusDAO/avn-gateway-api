// This script is started by executing command `/ec2/src$ node mq-consumer-test.js`
// It keeps pulling messages from a message queue synchronously, and try to reconnect if a connection is closed or failed be established.
// It receives a number of messages specified in the configuration file, then prints out each message as `Sent request [message]`,
// and finally acknowledges the queue to delete the message.

// TODO: Replace the service listening to avnTx post

'use strict'

const amqp = require('amqplib/callback_api');
const avn = require('./avn')
const config = require('multiconfig').load()
const logger = require('log4js').configure(config.log4Js).getLogger()
const SecretsManager = require('../../lambdas/send-handler-mq/secretsManager.js'); // TODO: Review and replace SM with alternatives if needed

async function connectToMQ() {
  let mqConsumer = new MQConsumer(
    config.mq.secretManagerRegion,
    config.mq.mqSecretArn,
    config.mq.mqBrokerAmqpEndpoint,
    config.mq.mqAvnTxnQueue
  )
  await mqConsumer.processMessagesFromMq()
}

function MQConsumer(secretsManagerRegion, secretArn, mqBrokerAmqpEndpoint, mqAvnTxnQueue) {
  this.secretsManager = new SecretsManager(secretsManagerRegion, logger)
  this.secretArn = secretArn
  this.mqBrokerAmqpEndpoint = mqBrokerAmqpEndpoint
  this.queue = mqAvnTxnQueue
}

MQConsumer.prototype.getMqConnectionUrl = async function() {
  const secret = await this.secretsManager.getSecret(this.secretArn);
  return this.mqBrokerAmqpEndpoint.replace('amqps://', `amqps://${encodeURIComponent(secret.username)}:${encodeURIComponent(secret.password)}@`);
}

MQConsumer.prototype.processMessagesFromMq = async function() {
  const queue = this.queue;
  amqp.connect(await this.getMqConnectionUrl(), function(err, conn) {
    logger.info('[AMQP] connecting')

    if (err) {
      logger.error('[AMQP] connect error', err.message)
      return setTimeout(processMessagesFromMq, 1000)
    }

    conn.on('error', function(err) {
      if (err.message !== '[AMQP] connection closing') {
        logger.error('[AMQP] connection error', err.message)
      }
    })

    conn.on("close", function() {
      logger.error("[AMQP] reconnecting")
      return setTimeout(processMessagesFromMq, 1000)
    })

    logger.info('[AMQP] connected')

    whenConnected(conn, queue)
  })
}

async function whenConnected(conn, queue) {
  const amqpChannel = await createChannel(conn)
  amqpChannel.assertQueue(queue, { durable: true })

  logger.info("MQ message processor is started")
  while(true) {
    await processMessage(amqpChannel, queue)
  }
}

async function processMessage(channel, queue) {
  await new Promise((resolve, reject) => {
    channel.get(queue, { 
      noAck: false 
    }, function(err, message) {
      if (err) channel.reject(message, true)
      if (message) {
        const msg = JSON.parse(message.content.toString())
        sendAvnTxn(msg, function(ok, requeue) {
          if (ok){
            channel.ack(message)
            resolve()
          } else {
            const allUpTo = false
            channel.nack(message, allUpTo, requeue)
            reject()
          }
        })
      } else { 
        resolve() /* empty queue */
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

      channel.on("error", function(err) {
        logger.error("[AMQP] channel error", err.message)
      })
  
      channel.on("close", function() {
        logger.info("[AMQP] channel closed")
      })

      logger.info('[AMQP] channel created')

      resolve(channel)
    })
  })
}

async function sendAvnTxn(request, callback) {
  try {
    logger.trace(`request body: ${JSON.stringify(request)}`)
    const result = await avn.tx(request.palletName, request.method, request.params)
    logger.info(`Request sent with ID: ${result.requestId} and received result: ${JSON.stringify(result)}`)
    callback(true)
  } catch (err) {
    // TODO: SYS-1530 Requeue or drop the messages based on error type when sending txns to AVN
    const requeue = true
    callback(false, requeue)
  }
}

module.exports = { connectToMQ }