const axios = require('axios');
const bigInt = require('big-integer');
const AVN_API_TX_ENDPOINT = 'http://ec2-35-178-74-219.eu-west-2.compute.amazonaws.com:3000/avnTx';
const AVN_API_PROXY_ENDPOINT = 'http://ec2-35-178-74-219.eu-west-2.compute.amazonaws.com:3000/avnProxy';

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
    response = await axios.post(AVN_API_TX_ENDPOINT, {palletName: palletName, method: method, params: params});
  } catch (e) {
    throw true;
  }
  return response.data.requestId;
}

async function sendProxyTx(palletName, method, params) {
  let response;
  try {
    response = await axios.post(AVN_API_PROXY_ENDPOINT, {palletName: palletName, method: method, params: params});
  } catch (e) {
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
      if (isValidAccountIDFormat(call.params[0]) && isValidAmount(call.params[1])) {
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
      // may add some verification in here
      // to do in SYS-1419
      let pallet = call.params.pallet;
      let method = call.params.method;

      let proof = {
        signer: call.params.innerArgs.from,
        relayer: call.params.relayerPublicKey,
        signature: {
          Sr25519: call.params.signature
        }
      }

      let formatter = codeFormatters[pallet][method];
      if (!formatter) {
        // error: unknown combination of method and pallet, invalid request
      }

      if (!formatter.validate(call.params.innerArgs)) {
        // error:
      }

      try {
        responseObject.result = await sendProxyTx(pallet, method, proof, formatter.encode(call.params.innerArgs));
      } catch (e) {
        // some errors
      }

    default:
      responseObject.error = {code:-32601, message:'Method not found'};
  }
  return responseObject;
}

codeFormatters.balances.transfer = {
  validate: function(params0, params1) {
    return (isValidAccountIDFormat(params0) && isValidAmount(params1));
  },

  encode: function(params0, params1) {
    return [params0, params1];
  }
};

// Can this be brought into a common.js file?
function isValidAccountIDFormat(accountId) {
  let charArray = accountId.split('');
  switch (charArray.length) {
    case 48: // TODO: SS58 address format may not always be 48 characters - check on this
      return charArray.every(c => '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'.includes(c));
    case 66:
      if (charArray.shift() !== '0' || charArray.shift() !== 'x') return false;
      return charArray.every(c => '0123456789abcdefABCDEF'.includes(c));
    default:
      return false;
  }
}

function isValidAmount(amount) {
  if (amount.match(/^[0-9]+$/)) {
    return ! bigInt(amount).isZero();
  } else {
    return false;
  }
}

// async function testlocal() {
//   console.log('transferAvt:', await processRequest('{"jsonrpc": "2.0", "method":"transferAvt", "params":["5DAgxVxKmnJ7hfhDEB9UetZm4jR2MPjGZGrmJZjirSVJDdMr", "2"], "id":5}'));
// }
//
// testlocal();