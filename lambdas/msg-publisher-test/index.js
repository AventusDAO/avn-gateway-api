const amqp = require('amqplib/callback_api');

const MQ_USERNAME = process.env.MQ_USERNAME;
const MQ_PASSWORD = process.env.MQ_PASSWORD;
const REQUEST_MQ_AMQP_URL = `amqps://${MQ_USERNAME}:${MQ_PASSWORD}@b-f74b3c3b-1e7d-4692-8259-66808cdb9cc6.mq.eu-west-2.amazonaws.com:5671`;

exports.handler = async (event) => {
  const response = {
    statusCode: 200,
    body: JSON.stringify(await processRequest(event))
  };
  return response;
};

async function processRequest(message) {
  console.info('Process Request:', JSON.stringify(message));
    
  amqp.connect(REQUEST_MQ_AMQP_URL, function(err, conn) {
    console.info("[AMQP] connecting");
  
    if (err) {
      console.error('[AMQP] connect error', err.message);
      return err.message;
    }
  
    conn.on("error", function(err) {
      if (err.message !== '[AMQP] connection closing') {
        console.error('[AMQP] connection error', err.message);
        return `[AMQP] connection error ${err.message}`;
      }
    });
      
    console.info("[AMQP] connected");
  
    conn.createChannel(function(error1, channel) {
      if (error1) {
        throw error1;
      }
        
      var queue = 'send-txn-queue';
  
      channel.assertQueue(queue, {
        durable: true
      });
    
      channel.sendToQueue(queue, Buffer.from("message"));
      console.log(" [x] Sent %s", "message");
      return message;
    });
  });
}

// async function testlocal() {
//   console.log('transferAvt:', await processRequest('{"jsonrpc": "2.0", "method":"transferAvt", "params":["5DAgxVxKmnJ7hfhDEB9UetZm4jR2MPjGZGrmJZjirSVJDdMr", "2"], "id":5}'));
// }

// testlocal();