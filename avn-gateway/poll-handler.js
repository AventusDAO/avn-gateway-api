const utils = require('/opt/utils.js')

const AVN_CONNECTOR_ENDPOINT = process.env.AVN_CONNECTOR_ENDPOINT

exports.handler = async event => {
  const response = {
    statusCode: 200,
    body: JSON.stringify(await processRequest(event.body))
  }
  return response
}

async function processRequest(request) {
  let response = { jsonrpc: '2.0' }
  let call

  try {
    call = JSON.parse(request)
  } catch (err) {
    const gatewayError = 'failed to parse JSON'
    utils.logError(gatewayError, null, err)
    response.error = { code: -32700, message: 'Parse error', data: { gatewayError, request } }
    response.id = null
    return response
  }

  if (typeof call.method !== 'string') {
    const gatewayError = 'method type must be string'
    utils.logError(gatewayError, call.id, call.method)
    response.error = { code: -32600, message: 'Invalid Request', data: { gatewayError, request } }
    return response
  } else {
    await makeCall(call, request, response)
  }

  response.id = call.id
  return response
}

async function makeCall(call, request, response) {
  const { requestId } = call.params

  if (call.method !== 'requestState') {
    const gatewayError = "method must be 'requestState'"
    utils.logError(gatewayError, call.id, call.method)
    response.error = { code: -32601, message: 'Method not found', data: { gatewayError, request } }
    return
  }

  if (utils.isValidRequestId(requestId) === false) {
    const gatewayError = 'invalid request ID'
    utils.logError(gatewayError, call.id, requestId)
    response.error = { code: -32602, message: 'Invalid params', data: { gatewayError, request } }
    return
  }

  await poll(request, response, call.id, requestId)
}

async function poll(request, response, callId, requestId) {
  try {
    const avnResponse = await utils.axios.post(AVN_CONNECTOR_ENDPOINT + 'avnPoll', { callId, requestId })
    response.result = avnResponse.data.error || avnResponse.data.status
  } catch (err) {
    const gatewayError = 'failed to poll chain'
    utils.logError(gatewayError, callId, err)
    response.error = { code: -32603, message: 'Internal error', data: { gatewayError, request } }
  }
}
