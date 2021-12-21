const utils = require('/opt/utils.js')

const AVN_CONNECTOR_ENDPOINT = process.env.AVN_CONNECTOR_ENDPOINT

exports.handler = async event => {
  const response = {
    statusCode: 200,
    body: JSON.stringify(await processRequest(event.body))
  }
  return response
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
    await callSwitch(call, responseObject)
  }

  responseObject.id = call.id
  return responseObject
}

// Keep alphabetical
async function callSwitch(call, responseObject) {
  switch (call.method) {
    case 'getAccountNonce':
      await getAccountNonce(call, responseObject)
      break
    case 'getAccountPaymentNonce':
      await getAccountPaymentNonce(call, responseObject)
      break
    case 'getAvtBalance':
      await getAvtBalance(call, responseObject)
      break
    case 'getAvtContractAddress':
      await getAvtContractAddress(call, responseObject)
      break
    case 'getNftId':
      await getNftId(call, responseObject)
      break
    case 'getNftNonce':
      await getNftNonce(call, responseObject)
      break
    case 'getRelayerFees':
      await getRelayerFees(call, responseObject)
      break
    case 'getTokenBalance':
      await getTokenBalance(call, responseObject)
      break
    case 'getTotalAvt':
      await getTotalAvt(call, responseObject)
      break
    default:
      utils.logError('method not found', call.id, call.method)
      responseObject.error = { code: -32601, message: 'Method not found' }
  }
}

async function queryChain(responseObject, callId, palletName, storageName, params, responseFormatter) {
  try {
    const response = await utils.axios.post(AVN_CONNECTOR_ENDPOINT + 'avnQuery', { callId, palletName, storageName, params })
    responseObject.result = response.data.error || responseFormatter(response.data, params)
  } catch (err) {
    utils.logError('failed to query chain', callId, err)
    responseObject.error = { code: -32603, message: 'Internal error' }
  }
}

async function getAccountNonce(call, responseObject) {
  const { accountId } = call.params

  if (utils.isValidAccountId(accountId) === false) {
    utils.logError('invalid account ID', call.id, accountId)
    responseObject.error = { code: -32602, message: 'Invalid params' }
  } else {
    await queryChain(responseObject, call.id, 'tokenManager', 'nonces', [accountId], formatNumAsString)
  }
}

async function getAccountPaymentNonce(call, responseObject) {
  const { accountId } = call.params

  if (utils.isValidAccountId(accountId) === false) {
    utils.logError('invalid account ID', call.id, accountId)
    responseObject.error = { code: -32602, message: 'Invalid params' }
  } else {
    await queryChain(responseObject, call.id, 'avnProxy', 'paymentNonces', [accountId], formatNumAsString)
  }
}

async function getAvtBalance(call, responseObject) {
  const { accountId } = call.params

  if (utils.isValidAccountId(accountId) === false) {
    utils.logError('invalid account ID', call.id, accountId)
    responseObject.error = { code: -32602, message: 'Invalid params' }
  } else {
    await queryChain(responseObject, call.id, 'system', 'account', [accountId], formatBalanceAsString)
  }
}

async function getAvtContractAddress(call, responseObject) {
  await queryChain(responseObject, call.id, 'tokenManager', 'aVTTokenContract', [], formatAsString)
}

async function getNftId(call, responseObject) {
  const { externalRef } = call.params

  if (utils.isValidString(externalRef) === false) {
    utils.logError('invalid external ref', call.id, externalRef)
    responseObject.error = { code: -32602, message: 'Invalid params' }
  } else {
    await queryChain(responseObject, call.id, 'nftManager', 'nfts', ['entries', externalRef], filterNftId)
  }
}

async function getNftNonce(call, responseObject) {
  const { nftId } = call.params

  if (utils.isValidNftId(nftId) === false) {
    utils.logError('invalid nft ID', call.id, nftId)
    responseObject.error = { code: -32602, message: 'Invalid params' }
  } else {
    await queryChain(responseObject, call.id, 'nftManager', 'nfts', [nftId], formatNftNonceAsString)
  }
}

async function getRelayerFees(call, responseObject) {
  let  { relayer, user, transactionType } = call.params

  try {
    if (utils.isValidAccountId(relayer) === false) throw 'relayer'
    if (user && utils.isValidAccountId(user) === false) throw 'user'
    if (transactionType && utils.isValidTransactionType(transactionType) === false) throw 'transaction type'
  } catch (param) {
    const errorMsg = 'invalid ' + param
    utils.logError(errorMsg, call.id, call.params)
    responseObject.error = { code: -32602, message: 'Invalid params' }
    return
  }

  try {
    relayer = utils.convertToAddress(relayer)
    user = utils.convertToAddress(user)
    const response = await utils.axios.post(AVN_CONNECTOR_ENDPOINT + 'relayerFees', { relayer, user, transactionType })
    responseObject.result = response.data
  } catch (err) {
    utils.logError('failed to call avn-connector', call.id, err)
    responseObject.error = { code: -32603, message: 'Internal error' }
  }
}

async function getTokenBalance(call, responseObject) {
  const { accountId, token } = call.params

  try {
    if (utils.isValidAccountId(accountId) === false) throw 'account ID'
    if (utils.isValidEthereumAddress(token) === false) throw 'token'
  } catch (param) {
    const errorMsg = 'invalid ' + param
    utils.logError(errorMsg, call.id, call.params)
    responseObject.error = { code: -32602, message: 'Invalid params' }
    return
  }

  await queryChain(responseObject, call.id, 'tokenManager', 'balances', [[token, accountId]], formatNumAsString)
}

async function getTotalAvt(call, responseObject) {
  await queryChain(responseObject, call.id, 'balances', 'totalIssuance', [], formatNumAsString)
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
