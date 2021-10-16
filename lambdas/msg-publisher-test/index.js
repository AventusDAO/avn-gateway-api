const AWS = require('aws-sdk');
const amqp = require('amqplib/callback_api');
const smClient = new AWS.SecretsManager({region: process.env.SECRET_MANAGER_REGION})

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
      if (err.code === 'DecryptionFailureException')
        throw err;
      else if (err.code === 'InternalServiceErrorException')
        throw err;
      else if (err.code === 'InvalidParameterException')
        throw err;
      else if (err.code === 'InvalidRequestException')
        throw err;
      else if (err.code === 'ResourceNotFoundException')
        throw err;
    } else if ('SecretString' in data) {
      const secret = JSON.parse(data.SecretString);
      sendMessage(secret.username, secret.password, 'send-txn-queue', JSON.stringify(request));
    }
  });
}

function sendMessage(username, password, queue, message) {
  const url = process.env.MQ_BROKER_AMQP_ENDPOINT.replace('amqps://', `amqps://${username}:${password}@`);
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
    
      channel.sendToQueue(queue, Buffer.from(message));
      console.log('Sent %s to %s', message, queue);
      
      conn.close();
      console.info('[AMQP] disconnected');
      
      return message;
    });
  });
}

// async function testlocal() {
//   console.log('transferAvt:', await processRequest('{'jsonrpc': '2.0', 'method':'transferAvt', 'params':['5DAgxVxKmnJ7hfhDEB9UetZm4jR2MPjGZGrmJZjirSVJDdMr', '2'], 'id':5}'));
// }

// testlocal();