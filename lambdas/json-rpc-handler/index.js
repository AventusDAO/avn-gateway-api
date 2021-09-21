const axios = require('axios');
const jp = require('jsonpath');
const AVN_API_QUERY_ENDPOINT = 'http://ec2-35-178-74-219.eu-west-2.compute.amazonaws.com:3000/avnQuery';

exports.handler = async (event) => {
  const response = {
    statusCode: 200,
    body: JSON.stringify(await processCall(event.body))
  };
  return response;
};

async function queryChain(palletName, storageName, params, responsePath) {
  let response;
  try {
    response = await axios.post(AVN_API_QUERY_ENDPOINT, {palletName: palletName, storageName: storageName, params: params});
  } catch (e) {
    throw true;
  }
  return BigInt(jp.value(response, responsePath)).toString();
}

async function processCall(body) {
  let responseObject = {jsonrpc: '2.0'};``

  let call;
  try {
    call = JSON.parse(body);
  } catch (e) {
    responseObject.error = {code:-32700, message:'Parse error'};
    responseObject.id = null;
    return responseObject;
  }

  if (typeof call.method !== 'string') responseObject.error = {code:-32600, message:'Invalid Request'};

  switch (call.method) {
    case 'getTotalAvt':
      try {
        responseObject.result = await queryChain('balances', 'totalIssuance', [], 'data');
      } catch (e) {
        responseObject.error = {code:-32603, message:'Internal error'};
      }
      break;
    case 'getAvtBalance':
      if (isValidAccountIDFormat(call.params[0])) {
        try {
          responseObject.result = await queryChain('system', 'account', [call.params[0]], 'data.data.free');
        } catch (e) {
          responseObject.error = {code:-32603, message:'Internal error'};
        }
      } else {
        responseObject.error = {code:-32602, message:'Invalid params'};
      }
      break;
    case 'getTokenBalance':
      if (isValidAccountIDFormat(call.params[0]) && isValidTokenIdFormat(call.params[1])) {
        try {
          responseObject.result = await queryChain('tokenManager', 'balances', [[call.params[1], call.params[0]]], 'data');
        } catch (e) {
          responseObject.error = {code:-32603, message:'Internal error'};
        }
      } else {
        responseObject.error = {code:-32602, message:'Invalid params'};
      }
      break;
    case 'getAccountNonce':
      if (isValidAccountIDFormat(call.params[0])) {
        try {
          responseObject.result = await queryChain('tokenManager', 'nonces', [call.params[0]], 'data');
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

  responseObject.id = call.id;
  return responseObject;
}

function isValidAccountIDFormat(accountId) {
  let charArray = accountId.toLowerCase().split('');
  switch (charArray.length) {
    case 48:
      return charArray.every(c => 'abcdefghijklmnopqrstuvwxyz0123456789'.includes(c));
    case 66:
      if (charArray.shift() !== '0' || charArray.shift() !== 'x') return false;
      return charArray.every(c => 'abcdef0123456789'.includes(c));
    default:
      return false;
  }
}

function isValidTokenIdFormat(tokenId) {
  let charArray = tokenId.toLowerCase().split('');
  if (charArray.length !== 42) return false;
  if (charArray.shift() !== '0' || charArray.shift() !== 'x') return false;
  return charArray.every(c => 'abcdef0123456789'.includes(c));
}

// async function testlocal() {
//   console.log('getTotalAvt:', await processCall('{"jsonrpc": "2.0", "method":"getTotalAvt", "params":[], "id":1}'));
//   console.log('getAvtBalance:', await processCall('{"jsonrpc":"2.0", "method":"getAvtBalance", "params":["5GLVUNb9oKLesAjDt17X1N49xyp2fr62sKPAKLgmmNbDB9MH"], "id":2}'));
//   console.log('getTokenBalance:', await processCall('{"jsonrpc":"2.0", "method":"getTokenBalance", "params": ["5DAgxVxKmnJ7hfhDEB9UetZm4jR2MPjGZGrmJZjirSVJDdMr", "0x2adce7ada36d86253aa63bcf4aad9f84ccb9480e"], "id":3}'));
//   console.log('getAccountNonce:', await processCall('{"jsonrpc":"2.0", "method":"getAccountNonce", "params":["5GLVUNb9oKLesAjDt17X1N49xyp2fr62sKPAKLgmmNbDB9MH"], "id":4}'));
// }
//
// testlocal();