const utils = require('/opt/utils.js')

const AVN_CONNECTOR_ENDPOINT = process.env.AVN_CONNECTOR_ENDPOINT

exports.handler = async event => {
  let response = { jsonrpc: '2.0', id: null }
  return {
    statusCode: 200,
    body: JSON.stringify(await processRequest(event.body, response))
  }
}

async function processRequest(request) {
  let call

  try {
    call = JSON.parse(request)
  } catch (err) {
    return utils.errorResponse('parse', 'failed to parse JSON', err, request, response)
  }

  response.id = call.id

  if (typeof call.method !== 'string') {
    return utils.errorResponse('request', 'method type must be string', call.method, request, response)
  } else {
    return await makeCall(call, request, response)
  }
}

async function makeCall(call, request, response) {
  const { requestId } = call.params

  if (call.method !== 'requestState') {
    return utils.errorResponse('method', "method must be 'requestState'", call.method, request, response)
  }

  if (utils.isValidRequestId(requestId) === false) {
    return utils.errorResponse('params', 'invalid request ID', requestId, request, response)
  }

  return await poll(request, response, call.id, requestId)
}

async function poll(request, response, callId, requestId) {
  try {
    const avnResponse = await utils.axios.post(AVN_CONNECTOR_ENDPOINT + 'avnPoll', { callId, requestId })
    response.result = avnResponse.data.error || avnResponse.data.status
    return response
  } catch (err) {
    return utils.errorResponse('internal', 'failed to poll chain', err, request, response)
  }
}
