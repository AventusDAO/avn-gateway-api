const utils = require('../common/utils.js');
const EC2 = require('../common/resources.json').ec2_endpoint;
const axios = require('axios');

let userRequestId;

exports.handler = async (event) => {
  const response = {
    statusCode: 200,
    body: JSON.stringify(await processRequest(event.body))
  };
  return response;
};

// response formatters
const format1 = (data) => utils.toBnString(data);
const format2 = (data) => utils.toBnString(data.data.free);


async function queryChain(palletName, storageName, params, responseFormatter) {
  let response;
  try {
    response = await axios.post(EC2 + 'avnQuery', { userRequestId, palletName, storageName, params });
  } catch (e) {
    utils.logError(userRequestId, 'queryChain avnQuery:', e);
    throw true;
  }
  return response.data.error || responseFormatter(response.data);
}

async function processRequest(requestObject) {
  let responseObject = {jsonrpc: '2.0'};
  let call;

  try {
    call = JSON.parse(requestObject);
  } catch (e) {
    utils.logError(callid, 'processRequest parse JSON', e);
    responseObject.error = {code:-32700, message:'Parse error'};
    responseObject.id = null;
    return responseObject;
  }

  userRequestId = call.id;

  if (typeof call.method !== 'string') {
    utils.logError(userRequestId, 'processRequest method type', call.method);
    responseObject.error = {code:-32600, message:'Invalid Request'};
  } else {
    responseObject = await callSwitch(call, responseObject);
  }

  responseObject.id = userRequestId;
  return responseObject;
}

async function callSwitch(call, responseObject) {
  switch (call.method) {
    case 'getTotalAvt':
      try {
        responseObject.result = await queryChain('balances', 'totalIssuance', [], format1);
      } catch (e) {
        utils.logError(userRequestId, 'getTotalAvt queryChain', e);
        responseObject.error = {code:-32603, message:'Internal error'};
      }
      break;
    case 'getAvtBalance':
      if (utils.isValidAccountId(call.params[0])) {
        try {
          responseObject.result = await queryChain('system', 'account', [call.params[0]], format2);
        } catch (e) {
          utils.logError(userRequestId, 'getAvtBalance queryChain', e)
          responseObject.error = {code:-32603, message:'Internal error'};
        }
      } else {
        responseObject.error = {code:-32602, message:'Invalid params'};
      }
      break;
    case 'getTokenBalance':
      if (utils.isValidAccountId(call.params[0]) && utils.isValidTokenId(call.params[1])) {
        try {
          responseObject.result = await queryChain('tokenManager', 'balances', [[call.params[1], call.params[0]]], format1);
        } catch (e) {
          utils.logError(userRequestId, 'getTokenBalance queryChain', e);
          responseObject.error = {code:-32603, message:'Internal error'};
        }
      } else {
        utils.logError(userRequestId, 'getTokenBalance invalid params', call.params)
        responseObject.error = {code:-32602, message:'Invalid params'};
      }
      break;
    case 'getAccountNonce':
      if (utils.isValidAccountId(call.params[0])) {
        try {
          responseObject.result = await queryChain('tokenManager', 'nonces', [call.params[0]], format1);
        } catch(e) {
          utils.logError(userRequestId, 'getAccountNonce queryChain', e);
          responseObject.error = {code:-32603, message:'Internal error'};
        }
      } else {
        utils.logError(userRequestId, 'getAccountNonce invalid accountId', call.params[0]);
        responseObject.error = {code:-32602, message:'Invalid params'};
      }
      break;

    default:
      utils.logError(userRequestId, 'callSwitch method not found', method);
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
