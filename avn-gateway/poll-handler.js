const utils = require('/opt/utils.js')

const AVN_CONNECTOR_ENDPOINT = process.env.AVN_CONNECTOR_ENDPOINT

exports.handler = async event => {
  return {
    statusCode: 200,
    body: JSON.stringify(await processRequest(event.body))
  }
}

async function processRequest(request) {
  let call

  try {
    call = JSON.parse(request)
  } catch (err) {
    return utils.errorResponse('parse', 'failed to parse JSON', err, request, buildResponse(request))
  }

  if (typeof call.method !== 'string') {
    return utils.errorResponse('request', 'method type must be string', call.method, request, buildResponse(request, call.id))
  } else {
    return await makeCall(call, request)
  }
}

async function makeCall(call, request) {
  const { requestId } = call.params

  if (call.method !== 'requestState') {
    return utils.errorResponse('method', "method must be 'requestState'", call.method, request, buildResponse(request, call.id))
  }

  if (utils.isValidRequestId(requestId) === false) {
    return utils.errorResponse('params', 'invalid request ID', requestId, request, buildResponse(request, call.id))
  }

  return await poll(call, requestId, request)
}

async function poll(call, requestId, request) {
  try {
    const avnResponse = await utils.axios.post(AVN_CONNECTOR_ENDPOINT + 'avnPoll', { call.id, requestId })
    const result = avnResponse.data.error || avnResponse.data.status
    return buildResponse(request, call.id, result)
  } catch (err) {
    return utils.errorResponse('internal', 'failed to poll chain', err, request, buildResponse(request, call.id))
  }
}

function buildResponse(request, _id, _result) {
  const id = _id || null
  const result = _result || null
  return { jsonrpc: '2.0', id, result }
}
