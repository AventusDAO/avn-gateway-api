// This script is started by executing command `/ec2/src$ node mq-consumer-test.js`
// It keeps consuming messages from a message queue, and try to reconnect if a connection is closed or failed be established.
// It receives a number of messages specified in the configuration file, then prints out each message as `Sent request [message]`,
// and finally acknowledges the queue to delete the message.

// TODO: Integrate with existing services

'use strict'

const config = require('multiconfig').load();
const amqp = require('amqplib/callback_api');
const avn = require('./avn');
const AWS = require('aws-sdk');
const logger = require('log4js').configure(config.log4Js).getLogger();
const smClient = new AWS.SecretsManager({region: config.mq.secretManagerRegion});

let url = null;
let amqpConn = null;
let amqpChannel = null;

async function start() {
  await avn.instantiateEC2()
  smClient.getSecretValue({SecretId: config.mq.mqSecretArn}, function(err, data) {
    if (err) {
      logger.error('[SECRET MANAGER] get secret value error', err.message);
      throw err;
    } else if ('SecretString' in data) {
      let { username, password } = JSON.parse(data.SecretString);
      url = config.mq.mqBrokerAmqpEndpoint.replace('amqps://', `amqps://${encodeURIComponent(username)}:${encodeURIComponent(password)}@`);
      consumeMessages(config.mq.mqAvnTxnQueue);
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

async function sendRequest(req, callback) {
  try {
    const request = JSON.parse(req.content.toString());
    logger.trace(`request body: ${JSON.stringify(request)}`);
    const result = await avn.tx(request.palletName, request.method, request.params);
    logger.info(`Request sent with ID: ${result.requestId} and received result: ${JSON.stringify(result)}`);
    callback(true);
  } catch (err) {
    // TODO: SYS-1530 Ack(delete)/Nack(keep) the messages based on error type when sending txns to AVN
    callback(false);
  }
}

function closeOnErr(err) {
  if (!err) return false;
  logger.error("[AMQP] error", err);
  amqpConn.close();
  return true;
}

start();