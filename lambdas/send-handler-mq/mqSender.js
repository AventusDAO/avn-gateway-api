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
  return this.mqBrokerAmqpEndpoint.replace('amqps://', `amqps://${encodeURIComponent(secret.username)}:${encodeURIComponent(secret.password)}@`)
}

MQSender.prototype.sendMessageToMQ = async function(queue, message, persistent = true) {
  const amqpConnection = await connectToMessageBroker(await this.getMqConnectionUrl())
  const amqpChannel = await createChannel(amqpConnection)
  return await new Promise((resolve, reject) => {
    try {
      amqpChannel.assertQueue(queue, { durable: true })
      amqpChannel.sendToQueue(queue, Buffer.from(JSON.stringify(message)), {
        persistent: persistent
      })
      console.info('Sent %s to %s', JSON.stringify(message), queue)
    } catch (e) {
      reject(e.message)
    }
  })
}

function connectToMessageBroker(url) {
  return new Promise((resolve, reject) => {
    amqp.connect(url, function(err, conn) {
      console.info('[AMQP] connecting')

      if (err) {
        console.error('[AMQP] connect error', err.message)
        return err.message
      }
  
      conn.on('error', function(err) {
        console.error('[AMQP] connection error', err.message)
        return `[AMQP] connection error ${err.message}`
      })
  
      console.info('[AMQP] connected')

      resolve(conn)
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

      channel.on("error", function(err) {
        console.error("[AMQP] channel error", err.message)
      })
  
      channel.on("close", function() {
        console.info("[AMQP] channel closed")
      })

      console.info('[AMQP] channel created')

      resolve(channel)
    })
  })
}