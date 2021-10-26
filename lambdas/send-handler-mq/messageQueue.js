'use strict'

const amqp = require('amqplib/callback_api');
const SecretsManager = require('./secretsManager.js'); // TODO: Review and replace SM with alternatives if needed

module.exports = MessageQueue;

function MessageQueue(secretsManagerRegion, secretArn) {
  this.secretsManager = new SecretsManager(secretsManagerRegion);
  this.secretArn = secretArn;
}

MessageQueue.prototype.getMqConnectionUrl = async function() {
    return await this.secretsManager.getSecret(this.secretArn);
}

MessageQueue.prototype.sendMessageToMQ = async function(queue, message, persistent = true) {
  const amqpConnection = await connectToBroker(this.getMqConnectionUrl());
  const amqpChannel = await createChannel(amqpConnection);
  return await new Promise((resolve, reject) => {
    try {
      amqpChannel.assertQueue(queue, { durable: true });
      amqpChannel.sendToQueue(queue, Buffer.from(JSON.stringify(message)), {
        persistent: persistent
      });
      console.info('Sent %s to %s', JSON.stringify(message), queue);
      setTimeout(function() {
        amqpConnection.close();
        console.info('[AMQP] connection closed');
        resolve(message);
      }, 500);
    } catch (e) {
      reject(e.message);
    }
  })
}

function connectToBroker(url) {
  return new Promise((resolve, reject) => {
    amqp.connect(url, function(err, conn) {
      console.info('[AMQP] connecting');

      if (err) {
        console.error('[AMQP] connect error', err.message);
        return err.message;
      }
  
      conn.on('error', function(err) {
        console.error('[AMQP] connection error', err.message);
        return `[AMQP] connection error ${err.message}`;
      });
  
      console.info('[AMQP] connected');

      resolve(conn);
    });
  });
}
  
function createChannel(conn) {
  return new Promise((resolve, reject) => {
    conn.createChannel(function(err, channel) {
      if (err) {
        console.error('[AMQP] channel connection error', err.message);
        throw err;
      }

      console.info('[AMQP] channel created');

      resolve(channel);
    });
  });
}