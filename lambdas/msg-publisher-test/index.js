/* Environment variables:
* MQ_BROKER_AMQP_ENDPOINT: Use to build connection url to the RabbitMQ broker
* MQ_SECRET_ARN: Use to fetch user credentials to build the connection url
* SECRET_MANAGER_REGION: AWS region where the secret manager is located
 */

const AWS = require('aws-sdk');
const amqp = require('amqplib/callback_api');
const smClient = new AWS.SecretsManager({region: process.env.SECRET_MANAGER_REGION});
const REQUEST_QUEUE = 'send-txn-queue'; // TODO: Replace the hard coded queue name with an environment variable, or to be decided by the request method

let url = null;
let amqpConnection = null;
let amqpChannel = null;

exports.handler = function(event) {
  const response = {
    statusCode: 200,
    body: JSON.stringify(processRequest(event))
  };
  return response;
}

function processRequest(request) {
  smClient.getSecretValue({SecretId: process.env.MQ_SECRET_ARN}, function(err, data) {
    if (err) {
      console.error('[SECRET MANAGER] get secret value error', err.message);
      throw err;
    } else if ('SecretString' in data) {
      let { username, password } = JSON.parse(data.SecretString);
      url = process.env.MQ_BROKER_AMQP_ENDPOINT.replace('amqps://', `amqps://${encodeURIComponent(username)}:${encodeURIComponent(password)}@`);
      return startSendMessage(REQUEST_QUEUE, JSON.stringify(request));
    }
  });
}

function startSendMessage(queue, message) {
  amqp.connect(url, function(err, conn) {
    console.info('[AMQP] connecting');

    if (err) {
      console.error('[AMQP] connect error', err.message);
      throw err;
    }

    conn.on('error', function(err) {
      if (err.message !== '[AMQP] connection closing') {
        console.error('[AMQP] connection error', err.message);
        throw err;
      }
    });

    amqpConnection = conn;
    console.info('[AMQP] connected');

    return sendMessage(queue, message);
  });
}

function sendMessage(queue, message) {
  try {
    amqpConnection.createChannel(function(err, channel) {
      if (err) {
        console.error('[AMQP] channel connection error', err.message);
        throw err;
      }

      channel.assertQueue(queue, {
        durable: true
      });

      amqpChannel = channel;
      send(queue, message);

      setTimeout(function() {
        amqpConnection.close();
        console.info('[AMQP] disconnected');
      }, 500);

      return message;
    });
  } catch (err) {
    throw err;
  }
}

function send(queue, message) {
  amqpChannel.sendToQueue(queue, Buffer.from(message), {
    persistent: true
  }, function(err, ok) {
    if (err) {
      console.error('[AMQP] sendToQueue', err.message);
      throw err;
    }
  });
  console.log('Sent %s to %s', message, queue);
}

// async function testlocal(n) {
//   for (var i = 0; i < n; i++) {
//     console.log('transferAvt:', processRequest(`{"jsonrpc": "2.0", "method":"transferAvt", "params":["5DAgxVxKmnJ7hfhDEB9UetZm4jR2MPjGZGrmJZjirSVJDdMr", "2"], "id":${i}}`));
//     await sleep(1000);
//   }
// }

// function sleep(ms) {
//   return new Promise((resolve, reject) => setTimeout(resolve, ms) )
// }

// testlocal(30);