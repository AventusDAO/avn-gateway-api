'use strict'

const amqp = require('amqplib/callback_api');
const SecretsManager = require('./secretsManager.js'); // TODO: Review and replace SM with alternatives if needed

module.exports = MessageQueue;

function MessageQueue() {
}

MessageQueue.prototype.initialise = async function(sm_region, secret_arn) {
    const sm = new SecretsManager(sm_region);
    const url = await sm.getSecret(secret_arn);
    this.amqpConnection = await connectToBroker(url);
    this.amqpChannel = await createChannel(this.amqpConnection);
}

MessageQueue.prototype.sendMessageToMQ = async function(queue, message, persistent = true) {
  const self = this;
  return await new Promise((resolve, reject) => {
    self.amqpChannel.assertQueue(queue, { durable: true });
    self.amqpChannel.sendToQueue(queue, Buffer.from(JSON.stringify(message)), {
      persistent: persistent
    }, function(err, ok) {
      if (err) {
        console.error('[AMQP] sendToQueue', err.message);
        reject(err);
      }
      if (ok) {
        console.info('Sent %s to %s', message, queue);
        setTimeout(function() {
          amqpConnection.close();
          console.info('[AMQP] disconnected');
        }, 500);
        resolve(message);
      }
    });
    console.log('Sent %s to %s', JSON.stringify(message), queue);
    setTimeout(function() {
      self.amqpConnection.close();
      console.info('[AMQP] disconnected');
    }, 500);
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
        if (err.message !== '[AMQP] connection closing') {
          console.error('[AMQP] connection error', err.message);
          return `[AMQP] connection error ${err.message}`;
        }
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

      channel.assertQueue('avnTx', {
        durable: true
      });

      console.info('[AMQP] channel created');

      resolve(channel);
    });
  });
}