'use strict'

const amqp = require('amqplib/callback_api');
const SecretsManager = require('./secretsManager.js'); // TODO: Review and replace SM with alternatives if needed

// TODO: Fix the logger used by the caller:
//   lambda function is using console to log
//   ec2 script is using log4js

module.exports = MessageQueue;

function MessageQueue(secretsManagerRegion, secretArn, mqBrokerAmqpEndpoint) {
  this.secretsManager = new SecretsManager(secretsManagerRegion);
  this.secretArn = secretArn;
  this.mqBrokerAmqpEndpoint = mqBrokerAmqpEndpoint;
}

MessageQueue.prototype.getMqConnectionUrl = async function() {
  const secret = await this.secretsManager.getSecret(this.secretArn);
  return this.mqBrokerAmqpEndpoint.replace('amqps://', `amqps://${encodeURIComponent(secret.username)}:${encodeURIComponent(secret.password)}@`);
}

MessageQueue.prototype.sendMessageToMQ = async function(queue, message, persistent = true) {
  const amqpConnection = await connectToMessageBroker(await this.getMqConnectionUrl());
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

MessageQueue.prototype.processMessagesFromMq = async function(queue, messageWorker) {
  amqp.connect(await this.getMqConnectionUrl(), function(err, conn) {
    console.info('[AMQP] connecting');

    if (err) {
      console.error('[AMQP] connect error', err.message);
      return setTimeout(processMessagesFromMq, 1000);
    }

    conn.on('error', function(err) {
      if (err.message !== '[AMQP] connection closing') {
        console.error('[AMQP] connection error', err.message);
      }
    });

    conn.on("close", function() {
      console.error("[AMQP] reconnecting");
      return setTimeout(processMessagesFromMq, 1000);
    });

    console.info('[AMQP] connected');

    whenConnected(conn, queue, messageWorker);
  });
}

async function whenConnected(conn, queue, messageWorker) {
  const amqpChannel = await createChannel(conn);
  amqpChannel.assertQueue(queue, { durable: true });

  console.info("MQ message processor is started");
  while(true) {
    await processMessage(amqpChannel, queue, messageWorker);
  }
}

async function processMessage(channel, queue, messageWorker) {
  return await new Promise((resolve, reject) => {
    channel.get(queue, { 
      noAck: false 
    }, function(err, message) {
      if (err) channel.reject(message, true);
      if (message) {
        const msg = JSON.parse(message.content.toString());
        messageWorker(msg, function(ok, requeue) {
          if (ok){
            channel.ack(message);
            resolve(message);
          } else {
            const allUpTo = false;
            channel.nack(message, allUpTo, requeue);
            reject()
          }
        });
      } else { 
        resolve() /* empty queue */
      }
    });
  });
}

function connectToMessageBroker(url) {
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

      channel.on("error", function(err) {
        console.error("[AMQP] channel error", err.message);
      });
  
      channel.on("close", function() {
        console.info("[AMQP] channel closed");
      });

      console.info('[AMQP] channel created');

      resolve(channel);
    });
  });
}