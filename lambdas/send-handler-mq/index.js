// const utils = require('/opt/nodejs/utils');
// const EC2 = require('/opt/nodejs/resources.json').ec2_endpoint;
const utils = require('../common/utils');
const EC2 = require('../common/resources.json').ec2_endpoint;
const axios = require('axios');

const AWS = require('aws-sdk');
const amqp = require('amqplib/callback_api');
const smClient = new AWS.SecretsManager({region: 'eu-west-2'});
const REQUEST_QUEUE = 'avnTx'; // TODO: Replace the hard coded queue name with an environment variable, or to be decided by the request method

let url = null;
let amqpConnection = null;
let amqpChannel = null;

exports.handler = async (event) => {
  const response = {
    statusCode: 200,
    body: JSON.stringify(await processRequest(event.body))
  };
  return response;
};

async function sendTx(palletName, method, params) {
  let response;
  try {
    response = processMessage({palletName: palletName, method: method, params: params});
  } catch (e) {
    console.log('sendTx Error:', e);
    throw true;
  }
  return response.data.error || response.data.requestId;
}

async function sendProxyTx(palletName, method, params) {
  let response;
  try {
    response = await axios.post(EC2 + 'avnProxy', {palletName: palletName, method: method, params: params});
  } catch (e) {
    console.log('sendProxyTx Error:', e);
    throw true;
  }
  return response.data.requestId;
}

async function processRequest(requestObject) {
  let responseObject = {jsonrpc: '2.0'};
  let call;

  try {
    call = JSON.parse(requestObject);
  } catch (e) {
    console.log('error processing request object', e);
    responseObject.error = {code:-32700, message:'Parse error'};
    responseObject.id = null;
    return responseObject;
  }

  if (typeof call.method !== 'string') {
    responseObject.error = {code:-32600, message:'Invalid Request'};
  } else {
    responseObject = await callSwitch(call, responseObject);
  }

  responseObject.id = call.id;
  return responseObject;
}

async function callSwitch(call, responseObject) {
  switch (call.method) {
    case 'transferAvt':
      if (utils.isValidAccountId(call.params[0]) && utils.isValidAmount(call.params[1])) {
        try {
          responseObject.result = await sendTx('balances', 'transfer', [call.params[0], call.params[1]]);
        } catch (e) {
          responseObject.error = {code:-32603, message:'Internal error'};
        }
      } else {
        responseObject.error = {code:-32602, message:'Invalid params'};
      }
      break;

    case 'proxy':
      let pallet = call.params.pallet;
      let method = call.params.method;

      let formatter = codeFormatters[pallet][method];

      if (!formatter) {
        responseObject.error = {code:-32601, message:'Method not found'};
      } else if (!formatter.validate(call)) {
        responseObject.error = {code:-32602, message:'Invalid params'};
      } else {
        try {
          let proof = {
            signer: call.params.innerArgs.from,
            relayer: call.params.relayer,
            signature: {
              Sr25519: call.params.signature
            }
          }
          responseObject.result = await sendProxyTx(pallet, method, formatter.encode(proof, call.params.innerArgs));
        } catch (e) {
          responseObject.error = {code:-32603, message:'Internal error'};
        }
      }
      break;

    default:
      responseObject.error = {code:-32601, message:'Method not found'};
  }
  return responseObject;
}

const codeFormatters = {
  balances: {
    transfer : {
      validate: function(params0, params1) {
        return (utils.isValidAccountId(params0) && utils.isValidAmount(params1));
      },
      encode: function(params0, params1) {
        return [params0, params1];
      }
    },
  },
  tokenManager: {
    signedTransfer: {
      validate: function(call) {
        return (
          utils.isValidAccountId(call.params.relayer)
          && utils.isValidAccountId(call.params.innerArgs.from)
          && utils.isValidAccountId(call.params.innerArgs.to)
          && utils.isValidTokenId(call.params.innerArgs.token)
          && utils.isValidAmount(call.params.innerArgs.amount.toString())
        );
      },
      encode: function(proof, innerArgs) {
        return [proof, innerArgs.from, innerArgs.to, innerArgs.token, innerArgs.amount];
      }
    }
  },
};

function processMessage(message) {
  smClient.getSecretValue({SecretId: process.env.MQ_SECRET_ARN}, function(err, data) {
    if (err) {
      console.error('[SECRET MANAGER] get secret value error', err.message);
      throw err;
    } else if ('SecretString' in data) {
      let { username, password } = JSON.parse(data.SecretString);
      url = process.env.MQ_BROKER_AMQP_ENDPOINT.replace('amqps://', `amqps://${encodeURIComponent(username)}:${encodeURIComponent(password)}@`);
      return startSendMessage(REQUEST_QUEUE, JSON.stringify(message));
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

async function testlocal() {
  console.log('transferAvt:', await processRequest('{"jsonrpc": "2.0", "method":"transferAvt", "params":["5DAgxVxKmnJ7hfhDEB9UetZm4jR2MPjGZGrmJZjirSVJDdMr", "2"], "id":5}'));
}

testlocal();