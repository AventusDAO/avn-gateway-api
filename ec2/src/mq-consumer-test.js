'use strict'
const config = require('multiconfig').load().mqConsumerTest;
const amqp = require('amqplib/callback_api');
const AWS = require('aws-sdk');
const smClient = new AWS.SecretsManager({region: config.secretManagerRegion});
const REQUEST_QUEUE = 'send-txn-queue';

function consumeMessages() {
  smClient.getSecretValue({SecretId: config.mqSecretArn}, function(err, data) {
    if (err) {
      console.error('[SECRET MANAGER] get secret value error', err.message);
      throw err;
    } else if ('SecretString' in data) {
      const secret = JSON.parse(data.SecretString);
      consumeMessagesFromQueue(secret.username, secret.password, REQUEST_QUEUE);
    }
  });
};

function consumeMessagesFromQueue(username, password, queue) {
  const url = config.mqBrokerAmqpEndpoint.replace('amqps://', `amqps://${username}:${password}@`);
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

    conn.createChannel(function(err, channel) {
      if (err) {
        console.error('[AMQP] channel connection error', err.message);
        throw err;
      }

      channel.on("error", function(err) {
        console.error("[AMQP] channel error", err.message);
      });

      channel.assertQueue(queue, { durable: true });
      channel.prefetch(config.prefetchSize);
      channel.consume(queue, 
        function(request) {
          sendRequest(request, function(ok) {
            try {
              if (ok)
                channel.ack(request);
              else
                channel.reject(request, true);
            } catch (err) {
              console.error("[AMQP] error", err);
              closeConnection(conn);
              throw err;
            }
          });
        }, { 
          noAck: false 
        });
    });
  });
}

function sendRequest(request, callback) {
  console.log("Received request ", request.content.toString());
  callback(true);
}
  
function closeConnection(conn) {
  conn.close();
  console.info('[AMQP] disconnected');
}

consumeMessages();