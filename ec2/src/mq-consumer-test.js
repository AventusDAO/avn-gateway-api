'use strict'

const config = require('multiconfig').load().mq;
const amqp = require('amqplib/callback_api');
const AWS = require('aws-sdk');
const smClient = new AWS.SecretsManager({region: config.secretManagerRegion});
const REQUEST_QUEUE = 'send-txn-queue'; // TODO: Replace the hard coded queue name with an environment variable, or to be decided by the request method

let url = null;
let amqpConn = null;
let amqpChannel = null;

function start() {
  smClient.getSecretValue({SecretId: config.mqSecretArn}, function(err, data) {
    if (err) {
      console.error('[SECRET MANAGER] get secret value error', err.message);
      throw err;
    } else if ('SecretString' in data) {
      let { username, password } = JSON.parse(data.SecretString);
      url = config.mqBrokerAmqpEndpoint.replace('amqps://', `amqps://${encodeURIComponent(username)}:${encodeURIComponent(password)}@`);
      consumeMessages(REQUEST_QUEUE);
    }
  });
};

function consumeMessages(queue) {
  amqp.connect(url, function(err, conn) {
    console.info('[AMQP] connecting');

    if (err) {
      console.error('[AMQP] connect error', err.message);
      return setTimeout(consumeMessages, 1000);
    }

    conn.on('error', function(err) {
      if (err.message !== '[AMQP] connection closing') {
        console.error('[AMQP] connection error', err.message);
      }
    });

    conn.on("close", function() {
      console.error("[AMQP] reconnecting");
      return setTimeout(consumeMessages, 1000);
    });

    console.info('[AMQP] connected');

    amqpConn = conn;

    whenConnected(queue);
  });
}

function whenConnected(queue) {
  amqpConn.createChannel(function(err, channel) {
    if (closeOnErr(err)) return;

    channel.on("error", function(err) {
      console.error("[AMQP] channel error", err.message);
    });

    channel.on("close", function() {
      console.info("[AMQP] channel closed");
    });

    amqpChannel = channel;

    channel.assertQueue(queue, { durable: true }, function(err, _ok) {
      if (closeOnErr(err)) return;
      consume(queue);
      console.info("consumeMessages is started");
    });
  });
}

function consume(queue) {
  amqpChannel.prefetch(config.prefetchSize);
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

function sendRequest(message, callback) {
  console.info("Got msg ", message.content.toString());
  callback(true);
}

function closeOnErr(err) {
  if (!err) return false;
  console.error("[AMQP] error", err);
  amqpConn.close();
  return true;
}

start();