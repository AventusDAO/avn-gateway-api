'use strict'

const amqp = require('amqplib/callback_api')
const SecretsManager = require('./secretsManager.js') // TODO: Review and replace SM with alternatives if needed

module.exports = MQSender

function MQSender(secretsManagerRegion, secretArn, mqBrokerAmqpEndpoint) {
  this.secretsManager = new SecretsManager(secretsManagerRegion, console)
  this.secretArn = secretArn
  this.mqBrokerAmqpEndpoint = mqBrokerAmqpEndpoint
}

MQSender.prototype.getMqConnectionUrl = async function() {
  const secret = await this.secretsManager.getSecret(this.secretArn)
  return this.mqBrokerAmqpEndpoint.replace(
    'amqps://',
    `amqps://${encodeURIComponent(secret.username)}:${encodeURIComponent(secret.password)}@`
  )
}

MQSender.prototype.sendMessageToMQ = async function(queue, message, persistent = true) {
  const amqpChannel = await createChannel(this.amqpConnection)
  return await new Promise((resolve, reject) => {
    try {
      amqpChannel.checkQueue(queue, function(err, ok) {
        if (err) throw Error(`queue '${queue}' does not exist`)
        if (ok) {
          amqpChannel.sendToQueue(queue, Buffer.from(JSON.stringify(message)), {
            persistent: persistent
          })
          console.info('Sent %s to %s', JSON.stringify(message), queue)

          amqpChannel.close()
          console.info('[AMQP] channel closed')

          resolve(message)
        }
      })
    } catch (e) {
      reject(e.message)
    }
  })
}

MQSender.prototype.connectToMessageBroker = async function() {
  const url = await this.getMqConnectionUrl()
  let self = this
  await new Promise((resolve, reject) => {
    amqp.connect(url, function(err, conn) {
      console.info('[AMQP] connecting')

      if (err) {
        console.error('[AMQP] connect error', err.message)
        reject()
      }

      conn.on('error', function(err) {
        console.error('[AMQP] connection error', err.message)
        reject()
      })

      conn.on("close", function() {
        console.error("[AMQP] connection closed");
        self.amqpConnected = false
        reject()
      })

      console.info('[AMQP] connected')
      self.amqpConnected = true
      self.amqpConnection = conn
      resolve()
    })
  })
}

function createChannel(conn) {
  return new Promise((resolve, reject) => {
    conn.createChannel(function(err, channel) {
      if (err) {
        console.error('[AMQP] channel connection error', err.message)
        throw err
      }

      channel.on('error', function(err) {
        console.error('[AMQP] channel error', err.message)
      })

      channel.on('close', function() {
        console.info('[AMQP] channel closed')
      })

      console.info('[AMQP] channel created')

      resolve(channel)
    })
  })
}
