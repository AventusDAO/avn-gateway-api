const utils = require('../layer/nodejs/utils.js')
const EC2 = require('../layer/nodejs/resources.json').ec2_endpoint
const axios = require('axios')

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

async function queryChain(callId, palletName, storageName, params, responseFormatter) {
  let response
  try {
    response = await axios.post(EC2 + 'avnQuery', { callId, palletName, storageName, params })
  } catch (err) {
    throw err
  }
  return response.data.error || responseFormatter(response.data)
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
      if (utils.isValidAccountId(call.params[0]) && utils.isValidTokenId(call.params[1])) {
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
    case 'getAvtContractAddress':
      try {
        responseObject.result = await queryChain(call.id, 'tokenManager', 'aVTTokenContract', [], res => res.toString())
      } catch (e) {
        responseObject.error = { code: -32603, message: 'Internal error' }
      }
      break
    default:
      utils.logError('method not found', call.id, 'query-handler.callSwitch.default', method)
      responseObject.error = { code: -32601, message: 'Method not found' }
  }
  return responseObject
}

// async function testlocal() {
//   console.log('getTotalAvt:', await processRequest('{"jsonrpc": "2.0", "method":"getTotalAvt", "params":[], "id":1}'));
//   console.log('getAvtBalance:', await processRequest('{"jsonrpc":"2.0", "method":"getAvtBalance", "params":["5GLVUNb9oKLesAjDt17X1N49xyp2fr62sKPAKLgmmNbDB9MH"], "id":2}'));
//   console.log('getTokenBalance:', await processRequest('{"jsonrpc":"2.0", "method":"getTokenBalance", "params": ["5DAgxVxKmnJ7hfhDEB9UetZm4jR2MPjGZGrmJZjirSVJDdMr", "0x2adce7ada36d86253aa63bcf4aad9f84ccb9480e"], "id":3}'));
//   console.log('getAccountNonce:', await processRequest('{"jsonrpc":"2.0", "method":"getAccountNonce", "params":["5GLVUNb9oKLesAjDt17X1N49xyp2fr62sKPAKLgmmNbDB9MH"], "id":4}'));
// }
//
// testlocal();
