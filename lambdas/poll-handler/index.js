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

async function poll(requestId) {
  let response;
  try {
    response = await axios.post(EC2 + 'avnPoll', { userRequestId, requestId });
  } catch (e) {
    utils.logError(userRequestId, 'poll avnPoll', e);
    throw true;
  }
  return response.data.error || response.data.status;
}

async function processRequest(requestObject) {
  let responseObject = {jsonrpc: '2.0'};
  let call;

  try {
    call = JSON.parse(requestObject);
  } catch (e) {
    utils.logError(null, 'processRequest parse JSON', e);
    responseObject.error = {code:-32700, message:'Parse error'};
    responseObject.id = null;
    return responseObject;
  }

  userRequestId = call.id;

  if (typeof call.method !== 'string') {
    utils.logError(userRequestId, 'processRequest method type', call.method);
    responseObject.error = {code:-32600, message:'Invalid Request'};
  } else {
    responseObject = await makeCall(call, responseObject);
  }

  responseObject.id = userRequestId;
  return responseObject;
}

async function makeCall(call, responseObject) {
  if (call.method !== 'requestState') {
    utils.logError(userRequestId, 'makeCall invalid method', call.method);
    responseObject.error = {code:-32601, message:'Method not found'};
  } else if (utils.isValidRequestId(call.params[0])) {
    try {
      responseObject.result = await poll(call.params[0]);
    } catch (e) {
      utils.logError(userRequestId, 'makeCall poll', e);
      responseObject.error = {code:-32603, message:'Internal error'};
    }
  } else {
    responseObject.error = {code:-32602, message:'Invalid params'};
  }

  return responseObject;
}

// async function testlocal() {
//   console.log('requestState:', await processRequest('{"jsonrpc": "2.0", "method":"requestState", "params":["0x9f78ca5fb3fe3448295b77b42dd3695126b9bf2d414b24fcafd09886fe388283"], "id":6}'));
// }
//
// testlocal();
