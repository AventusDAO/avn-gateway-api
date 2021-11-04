const utils = require('../common/utils.js')
const EC2 = require('../common/resources.json').ec2_endpoint
const axios = require('axios')

exports.handler = async event => {
  const response = {
    statusCode: 200,
    body: JSON.stringify(await processRequest(event.body))
  }
  return response
}

async function poll(callId, requestId) {
  let response
  try {
    response = await axios.post(EC2 + 'avnPoll', { callId, requestId })
  } catch (err) {
    throw err
  }
  return response.data.error || response.data.status
}

async function processRequest(requestObject) {
  let responseObject = { jsonrpc: '2.0' }
  let call

  try {
    call = JSON.parse(requestObject)
  } catch (err) {
    utils.logError('failed to parse JSON', null, 'poll-handler.processRequest.parse', err)
    responseObject.error = { code: -32700, message: 'Parse error' }
    responseObject.id = null
    return responseObject
  }

  if (typeof call.method !== 'string') {
    utils.logError('method type must be string', call.id, 'poll-handler.processRequest.method', call.method)
    responseObject.error = { code: -32600, message: 'Invalid Request' }
  } else {
    responseObject = await makeCall(call, responseObject)
  }

  responseObject.id = call.id
  return responseObject
}

async function makeCall(call, responseObject) {
  if (call.method !== 'requestState') {
    utils.logError("method must be 'requestState'", call.id, 'poll-handler.makeCall.method', call.method)
    responseObject.error = { code: -32601, message: 'Method not found' }
  } else if (utils.isValidRequestId(call.params[0])) {
    try {
      responseObject.result = await poll(call.id, call.params[0])
    } catch (err) {
      utils.logError('failed to poll chain', call.id, 'poll-handler.poll', err)
      responseObject.error = { code: -32603, message: 'Internal error' }
    }
  } else {
    utils.logError('invalid request ID', call.id, 'poll-handler.makeCall.requestId', call.params[0])
    responseObject.error = { code: -32602, message: 'Invalid params' }
  }

  return responseObject
}

// async function testlocal() {
//   console.log('requestState:', await processRequest('{"jsonrpc": "2.0", "method":"requestState", "params":["0x9f78ca5fb3fe3448295b77b42dd3695126b9bf2d414b24fcafd09886fe388283"], "id":6}'));
// }
//
// testlocal();
