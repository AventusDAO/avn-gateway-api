'use strict'

const config = require('multiconfig').load();
const amqp = require('amqplib/callback_api');
const AWS = require('aws-sdk');
const logger = require('log4js').configure(config.log4Js).getLogger();
const smClient = new AWS.SecretsManager({region: config.mq.secretManagerRegion});
const REQUEST_QUEUE = 'send-txn-queue'; // TODO: Replace the hard coded queue name with an environment variable, or to be decided by the request method

let url = null;
let amqpConn = null;
let amqpChannel = null;

function start() {
  smClient.getSecretValue({SecretId: config.mq.mqSecretArn}, function(err, data) {
    if (err) {
      logger.error('[SECRET MANAGER] get secret value error', err.message);
      throw err;
    } else if ('SecretString' in data) {
      let { username, password } = JSON.parse(data.SecretString);
      url = config.mq.mqBrokerAmqpEndpoint.replace('amqps://', `amqps://${encodeURIComponent(username)}:${encodeURIComponent(password)}@`);
      consumeMessages(REQUEST_QUEUE);
    }
  });
};

function consumeMessages(queue) {
  amqp.connect(url, function(err, conn) {
    logger.info('[AMQP] connecting');

    if (err) {
      logger.error('[AMQP] connect error', err.message);
      return setTimeout(consumeMessages, 1000);
    }

    conn.on('error', function(err) {
      if (err.message !== '[AMQP] connection closing') {
        logger.error('[AMQP] connection error', err.message);
      }
    });

    conn.on("close", function() {
      logger.error("[AMQP] reconnecting");
      return setTimeout(consumeMessages, 1000);
    });

    logger.info('[AMQP] connected');

    amqpConn = conn;

    whenConnected(queue);
  });
}

function whenConnected(queue) {
  amqpConn.createChannel(function(err, channel) {
    if (closeOnErr(err)) return;

    channel.on("error", function(err) {
      logger.error("[AMQP] channel error", err.message);
    });

    channel.on("close", function() {
      logger.info("[AMQP] channel closed");
    });

    amqpChannel = channel;

    channel.assertQueue(queue, { durable: true }, function(err, _ok) {
      if (closeOnErr(err)) return;
      consume(queue);
      logger.info("MQ consumer is started");
    });
  });
}

function consume(queue) {
  amqpChannel.prefetch(config.mq.prefetchSize);
  amqpChannel.consume(queue, function(message) {
    sendRequest(message, function(ok) {
      try {
        if (ok)
          amqpChannel.ack(message);
        else
          amqpChannel.reject(message, true);
      } catch (err) {
        closeOnErr(err);
      }
    });
  }, { 
    noAck: false 
  });
}

function sendRequest(request, callback) {
  logger.trace("Sent request", request.content.toString());
  callback(true);
}

function closeOnErr(err) {
  if (!err) return false;
  logger.error("[AMQP] error", err);
  amqpConn.close();
  return true;
}

start();