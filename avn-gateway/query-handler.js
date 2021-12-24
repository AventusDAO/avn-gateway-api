const utils = require('/opt/utils.js')

const AVN_CONNECTOR_ENDPOINT = process.env.AVN_CONNECTOR_ENDPOINT

exports.handler = async event => {
  let response = { jsonrpc: '2.0', id: null }
  return {
    statusCode: 200,
    body: JSON.stringify(await processRequest(event.body, response))
  }
}

async function processRequest(request, response) {
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
    return await callSwitch(call, request, response)
  }
}

// Keep alphabetical
async function callSwitch(call, request, response) {
  switch (call.method) {
    case 'getAccountNonce':
      return await getAccountNonce(call, request, response)
    case 'getAccountPaymentNonce':
      return await getAccountPaymentNonce(call, request, response)
    case 'getAvtBalance':
      return await getAvtBalance(call, request, response)
    case 'getAvtContractAddress':
      return await getAvtContractAddress(call, request, response)
    case 'getNftId':
      return await getNftId(call, request, response)
    case 'getNftNonce':
      return await getNftNonce(call, request, response)
    case 'getNftOwner':
      return await getNftOwner(call, request, response)
    case 'getRelayerFees':
      return await getRelayerFees(call, request, response)
    case 'getTokenBalance':
      return await getTokenBalance(call, request, response)
    case 'getTotalAvt':
      return await getTotalAvt(call, request, response)
    default:
      return utils.errorResponse('method', 'method not found', call.method, request, response)
  }
}

async function getAccountNonce(call, request, response) {
  const { accountId } = call.params

  if (utils.isValidAccountId(accountId) === false) {
    return utils.errorResponse('params', 'invalid account ID', accountId, request, response)
  } else {
    return await queryChain(request, response, call.id, 'tokenManager', 'nonces', [accountId], formatNumAsString)
  }
}

async function getAccountPaymentNonce(call, request, response) {
  const { accountId } = call.params

  if (utils.isValidAccountId(accountId) === false) {
    return utils.errorResponse('params', 'invalid account ID', accountId, request, response)
  } else {
    return await queryChain(request, response, call.id, 'avnProxy', 'paymentNonces', [accountId], formatNumAsString)
  }
}

async function getAvtBalance(call, request, response) {
  const { accountId } = call.params

  if (utils.isValidAccountId(accountId) === false) {
    return utils.errorResponse('params', 'invalid account ID', accountId, request, response)
  } else {
    return await queryChain(request, response, call.id, 'system', 'account', [accountId], formatBalanceAsString)
  }
}

async function getAvtContractAddress(call, request, response) {
  return await queryChain(request, response, call.id, 'tokenManager', 'aVTTokenContract', [], formatAsString)
}

async function getNftId(call, request, response) {
  const { externalRef } = call.params

  if (utils.isValidString(externalRef) === false) {
    return utils.errorResponse('params', 'invalid external ref', externalRef, request, response)
  } else {
    return await queryChain(request, response, call.id, 'nftManager', 'nfts', ['entries', externalRef], filterNftId)
  }
}

async function getNftNonce(call, request, response) {
  const { nftId } = call.params

  if (utils.isValidNftId(nftId) === false) {
    return utils.errorResponse('params', 'invalid nft id', nftId, request, response)
  } else {
    return await queryChain(request, response, call.id, 'nftManager', 'nfts', [nftId], formatNftNonceAsString)
  }
}

async function getNftOwner(call, request, response) {
  const { nftId } = call.params

  if (utils.isValidNftId(nftId) === false) {
    return utils.errorResponse('params', 'invalid nft id', nftId, request, response)
  } else {
    return await queryChain(request, response, call.id, 'nftManager', 'nfts', ['entries', nftId], filterNftOwner)
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
    return utils.errorResponse('params', gatewayError, call.params, request, response)
  }

  try {
    relayer = utils.convertToAddress(relayer)
    user = utils.convertToAddress(user)
    const avnResponse = await utils.axios.post(AVN_CONNECTOR_ENDPOINT + 'relayerFees', { relayer, user, transactionType })
    response.result = avnResponse.data
    return response
  } catch (err) {
    return utils.errorResponse('internal', 'failed to call avn-connector', err, request, response)
  }
}

async function getTokenBalance(call, request, response) {
  const { accountId, token } = call.params

  try {
    if (utils.isValidAccountId(accountId) === false) throw 'account ID'
    if (utils.isValidEthereumAddress(token) === false) throw 'token'
  } catch (param) {
    const gatewayError = 'invalid ' + param
    return utils.errorResponse('params', gatewayError, call.params, request, response)
  }

  return await queryChain(request, response, call.id, 'tokenManager', 'balances', [[token, accountId]], formatNumAsString)
}

async function getTotalAvt(call, request, response) {
  return await queryChain(request, response, call.id, 'balances', 'totalIssuance', [], formatNumAsString)
}

async function queryChain(request, response, callId, palletName, storageName, params, responseFormatter) {
  try {
    const avnResponse = await utils.axios.post(AVN_CONNECTOR_ENDPOINT + 'avnQuery', { callId, palletName, storageName, params })
    response.result = avnResponse.data.error || responseFormatter(avnResponse.data, params)
    return response
  } catch (err) {
    return utils.errorResponse('internal', 'failed to query chain', err, request, response)
  }
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

const filterNftOwner = (data, params) => {
  const nftIdAsHex = '0x' + Buffer.from(params[1], 'utf8').toString('hex')
  const index = data.findIndex(nft => nft[1].nft_id === nftIdAsHex)
  const owner = index > -1 ? data[index][1].owner : undefined
  return owner
}
