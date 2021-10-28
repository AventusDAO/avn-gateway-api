'use strict'

const amqp = require('amqplib/callback_api');
const SecretsManager = require('./secretsManager.js'); // TODO: Review and replace SM with alternatives if needed

module.exports = MessageQueue;

function MessageQueue(secretsManagerRegion, secretArn, mqBrokerAmqpEndpoint, log) {
  this.secretsManager = new SecretsManager(secretsManagerRegion);
  this.secretArn = secretArn;
  this.mqBrokerAmqpEndpoint = mqBrokerAmqpEndpoint;
  this.log = log;
}

MessageQueue.prototype.getMqConnectionUrl = async function() {
  const secret = await this.secretsManager.getSecret(this.secretArn);
  return this.mqBrokerAmqpEndpoint.replace('amqps://', `amqps://${encodeURIComponent(secret.username)}:${encodeURIComponent(secret.password)}@`);
}

MessageQueue.prototype.sendMessageToMQ = async function(queue, message, persistent = true) {
  const log = this.log;
  const amqpConnection = await connectToMessageBroker(await this.getMqConnectionUrl(), log);
  const amqpChannel = await createChannel(amqpConnection, log);
  return await new Promise((resolve, reject) => {
    try {
      amqpChannel.assertQueue(queue, { durable: true });
      amqpChannel.sendToQueue(queue, Buffer.from(JSON.stringify(message)), {
        persistent: persistent
      });
      log.info('Sent %s to %s', JSON.stringify(message), queue);
      setTimeout(function() {
        amqpConnection.close();
        log.info('[AMQP] connection closed');
        resolve(message);
      }, 500);
    } catch (e) {
      reject(e.message);
    }
  })
}

MessageQueue.prototype.processMessagesFromMq = async function(queue, messageWorkerFn) {
  const log = this.log;
  amqp.connect(await this.getMqConnectionUrl(), function(err, conn) {
    log.info('[AMQP] connecting');

    if (err) {
      log.error('[AMQP] connect error', err.message);
      return setTimeout(processMessagesFromMq, 1000);
    }

    conn.on('error', function(err) {
      if (err.message !== '[AMQP] connection closing') {
        log.error('[AMQP] connection error', err.message);
      }
    });

    conn.on("close", function() {
      log.error("[AMQP] reconnecting");
      return setTimeout(processMessagesFromMq, 1000);
    });

    log.info('[AMQP] connected');

    whenConnected(conn, queue, messageWorkerFn, log);
  });
}

async function whenConnected(conn, queue, messageWorkerFn, log) {
  const amqpChannel = await createChannel(conn, log);
  amqpChannel.assertQueue(queue, { durable: true });

  log.info("MQ message processor is started");
  while(true) {
    await processMessage(amqpChannel, queue, messageWorkerFn);
  }
}

async function processMessage(channel, queue, messageWorkerFn) {
  return await new Promise((resolve, reject) => {
    channel.get(queue, { 
      noAck: false 
    }, function(err, message) {
      if (err) channel.reject(message, true);
      if (message) {
        const msg = JSON.parse(message.content.toString());
        messageWorkerFn(msg, function(ok, requeue) {
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

function connectToMessageBroker(url, log) {
  return new Promise((resolve, reject) => {
    amqp.connect(url, function(err, conn) {
      log.info('[AMQP] connecting');

      if (err) {
        log.error('[AMQP] connect error', err.message);
        return err.message;
      }
  
      conn.on('error', function(err) {
        log.error('[AMQP] connection error', err.message);
        return `[AMQP] connection error ${err.message}`;
      });
  
      log.info('[AMQP] connected');

      resolve(conn);
    });
  });
}
  
function createChannel(conn, log) {
  return new Promise((resolve, reject) => {
    conn.createChannel(function(err, channel) {
      if (err) {
        log.error('[AMQP] channel connection error', err.message);
        throw err;
      }

      channel.on("error", function(err) {
        log.error("[AMQP] channel error", err.message);
      });
  
      channel.on("close", function() {
        log.info("[AMQP] channel closed");
      });

      log.info('[AMQP] channel created');

      resolve(channel);
    });
  });
}