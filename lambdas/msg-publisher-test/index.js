/* Environment variables:
* MQ_BROKER_AMQP_ENDPOINT: Use to build connection url to the RabbitMQ broker
* MQ_SECRET_ARN: Use to fetch user credentials to build the connection url
* SECRET_MANAGER_REGION: AWS region where the secret manager is located
 */

const AWS = require('aws-sdk');
const amqp = require('amqplib/callback_api');
const smClient = new AWS.SecretsManager({region: process.env.SECRET_MANAGER_REGION});
const REQUEST_QUEUE = 'send-txn-queue'; // TODO: Replace the hard coded queue name with an environment variable, or to be decided by the request method

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
      const secret = JSON.parse(data.SecretString);
      sendMessage(secret.username, secret.password, REQUEST_QUEUE, JSON.stringify(request));
    }
  });
}

function sendMessage(username, password, queue, message) {
  const url = process.env.MQ_BROKER_AMQP_ENDPOINT.replace('amqps://', `amqps://${encodeURIComponent(username)}:${encodeURIComponent(password)}@`);
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
        
      channel.assertQueue(queue, {
        durable: true
      });
    
      channel.sendToQueue(queue, Buffer.from(message), { persistent: true }, 
        function(err, ok) {
          if (err) {
            console.error("[AMQP] sendToQueue", err);
            channel.connection.close();
            throw err;
          }
        }
      );
      console.log('Sent %s to %s', message, queue);
      
      conn.close();
      console.info('[AMQP] disconnected');
      
      return message;
    });
  });
}

// async function testlocal() {
//   console.log('transferAvt:', await processRequest("{'jsonrpc': '2.0', 'method':'transferAvt', 'params':['5DAgxVxKmnJ7hfhDEB9UetZm4jR2MPjGZGrmJZjirSVJDdMr', '2'], 'id':5}"));
// }

// testlocal();