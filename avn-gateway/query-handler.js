const utils = require('/opt/utils.js')

const AVN_CONNECTOR_ENDPOINT = process.env.AVN_CONNECTOR_ENDPOINT

exports.handler = async event => {
  const response = {
    statusCode: 200,
    body: JSON.stringify(await processRequest(event.body))
  }
  return response
}

// response formatters
const format1 = data => utils.toBnString(data)
const format2 = data => utils.toBnString(data.data.free)
const format3 = data => utils.toBnString(data.nonce)

const format4 = (data, params) => {
  const uniqueExternalRefAsHex = '0x' + Buffer.from(params[1], 'utf8').toString('hex')
  const index = data.findIndex(nft => nft[1].unique_external_ref === uniqueExternalRefAsHex)
  const nftId = index > -1 ? data[index][1].nft_id : undefined
  return nftId
}

async function queryChain(callId, palletName, storageName, params, responseFormatter) {
  let response
  try {
    response = await utils.axios.post(AVN_CONNECTOR_ENDPOINT + 'avnQuery', { callId, palletName, storageName, params })
  } catch (err) {
    throw err
  }
  return response.data.error || responseFormatter(response.data, params)
}

async function processRequest(requestObject) {
  let responseObject = { jsonrpc: '2.0' }
  let call

  try {
    call = JSON.parse(requestObject)
  } catch (err) {
    utils.logError('failed to parse JSON', null, 'query-handler.processRequest.parse', err)
    responseObject.error = { code: -32700, message: 'Parse error' }
    responseObject.id = null
    return responseObject
  }

  if (typeof call.method !== 'string') {
    utils.logError('method type must be string', call.id, 'query-handler.processRequest.method', call.method)
    responseObject.error = { code: -32600, message: 'Invalid Request' }
  } else {
    responseObject = await callSwitch(call, responseObject)
  }

  responseObject.id = call.id
  return responseObject
}

async function callSwitch(call, responseObject) {
  switch (call.method) {
    case 'getTotalAvt':
      try {
        responseObject.result = await queryChain(call.id, 'balances', 'totalIssuance', [], format1)
      } catch (err) {
        utils.logError('failed to query chain', call.id, 'query-handler.getTotalAvt.queryChain', err)
        responseObject.error = { code: -32603, message: 'Internal error' }
      }
      break
    case 'getAvtBalance':
      if (utils.isValidAccountId(call.params[0])) {
        try {
          responseObject.result = await queryChain(call.id, 'system', 'account', [call.params[0]], format2)
        } catch (err) {
          utils.logError('failed to query chain', call.id, 'query-handler.getAvtBalance.queryChain', err)
          responseObject.error = { code: -32603, message: 'Internal error' }
        }
      } else {
        utils.logError('invalid account ID', call.id, 'query-handler.getAvtBalance.params', call.params[0])
        responseObject.error = { code: -32602, message: 'Invalid params' }
      }
      break
    case 'getTokenBalance':
      if (utils.isValidAccountId(call.params[0]) && utils.isValidEthereumAddress(call.params[1])) {
        try {
          responseObject.result = await queryChain(
            call.id,
            'tokenManager',
            'balances',
            [[call.params[1], call.params[0]]],
            format1
          )
        } catch (err) {
          utils.logError('failed to query chain', call.id, 'query-handler.getTokenBalance.queryChain', err)
          responseObject.error = { code: -32603, message: 'Internal error' }
        }
      } else {
        utils.logError('invalid params', call.id, 'query-handler.getTokenBalance.params', call.params)
        responseObject.error = { code: -32602, message: 'Invalid params' }
      }
      break
    case 'getAccountNonce':
      if (utils.isValidAccountId(call.params[0])) {
        try {
          responseObject.result = await queryChain(call.id, 'tokenManager', 'nonces', [call.params[0]], format1)
        } catch (err) {
          utils.logError('failed to query chain', call.id, 'query-handler.getAccountNonce.queryChain', err)
          responseObject.error = { code: -32603, message: 'Internal error' }
        }
      } else {
        utils.logError('invalid account ID', call.id, 'query-handler.getAccountNonce.params', call.params[0])
        responseObject.error = { code: -32602, message: 'Invalid params' }
      }
      break
    case 'getNftNonce':
      if (utils.isValidNftId(call.params[0])) {
        try {
          responseObject.result = await queryChain(call.id, 'nftManager', 'nfts', [call.params[0]], format3)
        } catch (err) {
          utils.logError('failed to query chain', call.id, 'query-handler.getNftNonce.queryChain', err)
          responseObject.error = { code: -32603, message: 'Internal error' }
        }
      } else {
        utils.logError('invalid nft ID', call.id, 'query-handler.getNftNonce.params', call.params[0])
        responseObject.error = { code: -32602, message: 'Invalid params' }
      }
      break
    case 'getNftId':
      if (utils.isValidString(call.params[0])) {
        try {
          responseObject.result = await queryChain(call.id, 'nftManager', 'nfts', ['entries', call.params[0]], format4)
        } catch (err) {
          utils.logError('failed to query chain', call.id, 'query-handler.getNftId.queryChain', err)
          responseObject.error = { code: -32603, message: 'Internal error' }
        }
      } else {
        utils.logError('invalid external ref', call.id, 'query-handler.getNftId.params', call.params[0])
        responseObject.error = { code: -32602, message: 'Invalid params' }
      }
      break
    case 'getAccountPaymentNonce':
      if (utils.isValidAccountId(call.params[0])) {
        try {
          responseObject.result = await queryChain(call.id, 'avnProxy', 'paymentNonces', [call.params[0]], format1)
        } catch (err) {
          utils.logError('failed to query chain', call.id, 'query-handler.getAccountPaymentNonce.queryChain', err)
          responseObject.error = { code: -32603, message: 'Internal error' }
        }
      } else {
        utils.logError('invalid account ID', call.id, 'query-handler.getAccountPaymentNonce.params', call.params[0])
        responseObject.error = { code: -32602, message: 'Invalid params' }
      }
      break
    case 'getAvtContractAddress':
      try {
        responseObject.result = await queryChain(call.id, 'tokenManager', 'aVTTokenContract', [], res => res.toString())
      } catch (err) {
        utils.logError('failed to query chain', call.id, 'query-handler.getAvtContractAddress.query', err)
        responseObject.error = { code: -32603, message: 'Internal error' }
      }
      break
    case 'getRelayerFees':
      try {
        const relayer = call.params[0]
        const user = call.params[1]
        const transactionType = call.params[2]
        const response = await utils.axios.post(AVN_CONNECTOR_ENDPOINT + 'relayerFees', {
          relayer,
          user,
          transactionType
        })
        responseObject.result = response.data
      } catch (err) {
        utils.logError('failed to call avn-connector', call.id, 'query-handler.getRelayerFees', err)
        responseObject.error = { code: -32603, message: 'Internal error' }
      }
      break
    default:
      utils.logError('method not found', call.id, 'query-handler.callSwitch.default', call.method)
      responseObject.error = { code: -32601, message: 'Method not found' }
  }
  return responseObject
}
