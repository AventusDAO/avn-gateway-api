const utils = require('../common/utils.js');
const axios = require('axios');
const bigInt = require('big-integer');
const AVN_API_QUERY_ENDPOINT = 'http://ec2-35-178-74-219.eu-west-2.compute.amazonaws.com:3000/avnQuery';

exports.handler = async (event) => {
  const response = {
    statusCode: 200,
    body: JSON.stringify(await processRequest(event.body))
  };
  return response;
};

// response formatters
const toBigInt = (response) => bigInt(response.data).toString();
const toBigInt2 = (response) => bigInt(response.data.data.free.replace('0x',''), 16).toString();

async function queryChain(palletName, storageName, params, responseFormatter) {
  let response;
  try {
    response = await axios.post(AVN_API_QUERY_ENDPOINT, {palletName: palletName, storageName: storageName, params: params});
  } catch (e) {
    throw true;
  }
  return response.data.errror || responseFormatter(response);
}

async function processRequest(requestObject) {
  let responseObject = {jsonrpc: '2.0'};
  let call;

  try {
    call = JSON.parse(requestObject);
  } catch (e) {
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
    case 'getTotalAvt':
      try {
        responseObject.result = await queryChain('balances', 'totalIssuance', [], toBigInt);
      } catch (e) {
        responseObject.error = {code:-32603, message:'Internal error'};
      }
      break;
    case 'getAvtBalance':
      if (utils.isValidAccountId(call.params[0])) {
        try {
          responseObject.result = await queryChain('system', 'account', [call.params[0]], toBigInt2);
        } catch (e) {
          responseObject.error = {code:-32603, message:'Internal error'};
        }
      } else {
        responseObject.error = {code:-32602, message:'Invalid params'};
      }
      break;
    case 'getTokenBalance':
      if (utils.isValidAccountId(call.params[0]) && utils.isValidTokenId(call.params[1])) {
        try {
          responseObject.result = await queryChain('tokenManager', 'balances', [[call.params[1], call.params[0]]], toBigInt);
        } catch (e) {
          responseObject.error = {code:-32603, message:'Internal error'};
        }
      } else {
        responseObject.error = {code:-32602, message:'Invalid params'};
      }
      break;
    case 'getAccountNonce':
      if (utils.isValidAccountId(call.params[0])) {
        try {
          responseObject.result = await queryChain('tokenManager', 'nonces', [call.params[0]], toBigInt);
        } catch(e) {
          responseObject.error = {code:-32603, message:'Internal error'};
        }
      } else {
        responseObject.error = {code:-32602, message:'Invalid params'};
      }
      break;

    default:
      responseObject.error = {code:-32601, message:'Method not found'};
  }
  return responseObject;
}

// async function testlocal() {
//   console.log('getTotalAvt:', await processRequest('{"jsonrpc": "2.0", "method":"getTotalAvt", "params":[], "id":1}'));
//   console.log('getAvtBalance:', await processRequest('{"jsonrpc":"2.0", "method":"getAvtBalance", "params":["5GLVUNb9oKLesAjDt17X1N49xyp2fr62sKPAKLgmmNbDB9MH"], "id":2}'));
//   console.log('getTokenBalance:', await processRequest('{"jsonrpc":"2.0", "method":"getTokenBalance", "params": ["5DAgxVxKmnJ7hfhDEB9UetZm4jR2MPjGZGrmJZjirSVJDdMr", "0x2adce7ada36d86253aa63bcf4aad9f84ccb9480e"], "id":3}'));
//   console.log('getAccountNonce:', await processRequest('{"jsonrpc":"2.0", "method":"getAccountNonce", "params":["5GLVUNb9oKLesAjDt17X1N49xyp2fr62sKPAKLgmmNbDB9MH"], "id":4}'));
// }
//
// testlocal();
