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
  } else {
    await callSwitch(call, request, response)
  }

  response.id = call.id
  return response
}

// Keep alphabetical
async function callSwitch(call, request, response) {
  switch (call.method) {
    case 'getAccountNonce':
      await getAccountNonce(call, request, response)
      break
    case 'getAccountPaymentNonce':
      await getAccountPaymentNonce(call, request, response)
      break
    case 'getAvtBalance':
      await getAvtBalance(call, request, response)
      break
    case 'getAvtContractAddress':
      await getAvtContractAddress(call, request, response)
      break
    case 'getNftId':
      await getNftId(call, request, response)
      break
    case 'getNftNonce':
      await getNftNonce(call, request, response)
      break
    case 'getRelayerFees':
      await getRelayerFees(call, request, response)
      break
    case 'getTokenBalance':
      await getTokenBalance(call, request, response)
      break
    case 'getTotalAvt':
      await getTotalAvt(call, request, response)
      break
    default:
      const gatewayError = 'method not found'
      utils.logError(gatewayError, call.id, call.method)
      response.error = { code: -32601, message: 'Method not found', data: { gatewayError, request } }
  }
}

async function queryChain(request, response, callId, palletName, storageName, params, responseFormatter) {
  try {
    const avnResponse = await utils.axios.post(AVN_CONNECTOR_ENDPOINT + 'avnQuery', { callId, palletName, storageName, params })
    response.result = avnResponse.data.error || responseFormatter(avnResponse.data, params)
  } catch (err) {
    const gatewayError = 'failed to query chain'
    utils.logError(gatewayError, callId, err)
    response.error = { code: -32603, message: 'Internal error', data: { gatewayError, request } }
  }
}

async function getAccountNonce(call, request, response) {
  const { accountId } = call.params

  if (utils.isValidAccountId(accountId) === false) {
    const gatewayError = 'invalid account ID'
    utils.logError(gatewayError, call.id, accountId)
    response.error = { code: -32602, message: 'Invalid params', data: { gatewayError, request } }
  } else {
    await queryChain(request, response, call.id, 'tokenManager', 'nonces', [accountId], formatNumAsString)
  }
}

async function getAccountPaymentNonce(call, request, response) {
  const { accountId } = call.params

  if (utils.isValidAccountId(accountId) === false) {
    const gatewayError = 'invalid account ID'
    utils.logError(gatewayError, call.id, accountId)
    response.error = { code: -32602, message: 'Invalid params', data: { gatewayError, request } }
  } else {
    await queryChain(request, response, call.id, 'avnProxy', 'paymentNonces', [accountId], formatNumAsString)
  }
}

async function getAvtBalance(call, request, response) {
  const { accountId } = call.params

  if (utils.isValidAccountId(accountId) === false) {
    const gatewayError = 'invalid account ID'
    utils.logError(gatewayError, call.id, accountId)
    response.error = { code: -32602, message: 'Invalid params', data: { gatewayError, request } }
  } else {
    await queryChain(request, response, call.id, 'system', 'account', [accountId], formatBalanceAsString)
  }
}

async function getAvtContractAddress(call, request, response) {
  await queryChain(request, response, call.id, 'tokenManager', 'aVTTokenContract', [], formatAsString)
}

async function getNftId(call, request, response) {
  const { externalRef } = call.params

  if (utils.isValidString(externalRef) === false) {
    const gatewayError = 'invalid external ref'
    utils.logError(gatewayError, call.id, externalRef)
    response.error = { code: -32602, message: 'Invalid params', data: { gatewayError, request } }
  } else {
    await queryChain(request, response, call.id, 'nftManager', 'nfts', ['entries', externalRef], filterNftId)
  }
}

async function getNftNonce(call, request, response) {
  const { nftId } = call.params

  if (utils.isValidNftId(nftId) === false) {
    const gatewayError = 'invalid nft ID'
    utils.logError(gatewayError, call.id, nftId)
    response.error = { code: -32602, message: 'Invalid params', data: { gatewayError, request } }
  } else {
    await queryChain(request, response, call.id, 'nftManager', 'nfts', [nftId], formatNftNonceAsString)
  }
}

async function getRelayerFees(call, request, response) {
  let { relayer, user, transactionType } = call.params

  try {
    if (utils.isValidAccountId(relayer) === false) throw 'relayer'
    if (user && utils.isValidAccountId(user) === false) throw 'user'
    if (transactionType && utils.isValidTransactionType(transactionType) === false) throw 'transaction type'
  } catch (param) {
    const gatewayError = 'invalid ' + param
    utils.logError(gatewayError, call.id, call.params)
    response.error = { code: -32602, message: 'Invalid params', data: { gatewayError, request } }
    return
  }

  try {
    relayer = utils.convertToAddress(relayer)
    user = utils.convertToAddress(user)
    const avnResponse = await utils.axios.post(AVN_CONNECTOR_ENDPOINT + 'relayerFees', { relayer, user, transactionType })
    response.result = avnResponse.data
  } catch (err) {
    const gatewayError = 'failed to call avn-connector'
    utils.logError(gatewayError, call.id, err)
    response.error = { code: -32603, message: 'Internal error', data: { gatewayError, request } }
  }
}

async function getTokenBalance(call, request, response) {
  const { accountId, token } = call.params

  try {
    if (utils.isValidAccountId(accountId) === false) throw 'account ID'
    if (utils.isValidEthereumAddress(token) === false) throw 'token'
  } catch (param) {
    const gatewayError = 'invalid ' + param
    utils.logError(gatewayError, call.id, call.params)
    response.error = { code: -32602, message: 'Invalid params', data: { gatewayError, request } }
    return
  }

  await queryChain(request, response, call.id, 'tokenManager', 'balances', [[token, accountId]], formatNumAsString)
}

async function getTotalAvt(call, request, response) {
  await queryChain(request, response, call.id, 'balances', 'totalIssuance', [], formatNumAsString)
}

const formatAsString = data => data.toString()

const formatNumAsString = data => utils.toBnString(data)

const formatBalanceAsString = data => utils.toBnString(data.data.free)

const formatNftNonceAsString = data => utils.toBnString(data.nonce)

const filterNftId = (data, params) => {
  const uniqueExternalRefAsHex = '0x' + Buffer.from(params[1], 'utf8').toString('hex')
  const index = data.findIndex(nft => nft[1].unique_external_ref === uniqueExternalRefAsHex)
  const nftId = index > -1 ? data[index][1].nft_id : undefined
  return nftId
}
