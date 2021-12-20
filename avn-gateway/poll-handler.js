const utils = require('/opt/utils.js')

const AVN_CONNECTOR_ENDPOINT = process.env.AVN_CONNECTOR_ENDPOINT

exports.handler = async event => {
  const response = {
    statusCode: 200,
    body: JSON.stringify(await processRequest(event.body))
  }
  return response
}

async function poll(responseObject, callId, requestId) {
  let response
  try {
    response = await utils.axios.post(AVN_CONNECTOR_ENDPOINT + 'avnPoll', { callId, requestId })
  } catch (err) {
    utils.logError('failed to poll chain', call.id, err)
    responseObject.error = { code: -32603, message: 'Internal error' }
    return
  }
  responseObject.result = response.data.error || response.data.status
}

async function processRequest(requestObject) {
  let responseObject = { jsonrpc: '2.0' }
  let call

  try {
    call = JSON.parse(requestObject)
  } catch (err) {
    utils.logError('failed to parse JSON', null, err)
    responseObject.error = { code: -32700, message: 'Parse error' }
    responseObject.id = null
    return responseObject
  }

  if (typeof call.method !== 'string') {
    utils.logError('method type must be string', call.id, call.method)
    responseObject.error = { code: -32600, message: 'Invalid Request' }
  } else {
    responseObject = await makeCall(call, responseObject)
  }

  responseObject.id = call.id
  return responseObject
}

async function makeCall(call, responseObject) {
  const requestId = call.params[0]

  if (call.method !== 'requestState') {
    utils.logError("method must be 'requestState'", call.id, call.method)
    responseObject.error = { code: -32601, message: 'Method not found' }
  }

  if (utils.isValidUUID(requestId) === false) {
    utils.logError('invalid request ID', call.id, requestId)
    responseObject.error = { code: -32602, message: 'Invalid params' }
  }

  await poll(responseObject, call.id, requestId)
}
