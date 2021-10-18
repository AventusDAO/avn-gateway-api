const utils = require('../common/utils.js');
const axios = require('axios');
const AVN_API_POLL_ENDPOINT = require('../common/resources.json').EC2+'avnPoll';

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
    response = await axios.post(AVN_API_POLL_ENDPOINT, {requestId: requestId});
  } catch (e) {
    throw true;
  }
  return response.data.error || response.data.state;
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
    responseObject = await makeCall(call, responseObject);
  }

  responseObject.id = call.id;
  return responseObject;
}

async function makeCall(call, responseObject) {
  if (call.method !== 'requestState') {
    responseObject.error = {code:-32601, message:'Method not found'};
  } else if (utils.isValidRequestId(call.params[0])) {
    try {
      responseObject.result = await poll(call.params[0]);
    } catch (e) {
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
