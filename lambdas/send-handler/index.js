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

async function sendTx(callId, palletName, method, params) {
  let response
  try {
    response = await axios.post(EC2 + 'avnTx', { callId, palletName, method, params })
  } catch (err) {
    throw err
  }
  return response.data.error || response.data.requestId
}

async function sendProxyTx(callId, palletName, method, params) {
  let response
  try {
    response = await axios.post(EC2 + 'avnProxy', { callId, palletName, method, params })
  } catch (err) {
    throw err
  }
  return response.data.requestId
}

async function processRequest(requestObject) {
  let responseObject = { jsonrpc: '2.0' }
  let call

  try {
    call = JSON.parse(requestObject)
  } catch (err) {
    utils.logError('failed to parse JSON', null, 'send-handler.processRequest.parse', err)
    responseObject.error = { code: -32700, message: 'Parse error' }
    responseObject.id = null
    return responseObject
  }

  if (typeof call.method !== 'string') {
    utils.logError('method type must be string', call.id, 'send-handler.processRequest.method', call.method)
    responseObject.error = { code: -32600, message: 'Invalid Request' }
  } else {
    responseObject = await callSwitch(call, responseObject)
  }

  responseObject.id = call.id
  return responseObject
}

async function callSwitch(call, responseObject) {
  switch (call.method) {
    case 'transferAvt':
      if (utils.isValidAccountId(call.params[0]) && utils.isValidAmount(call.params[1])) {
        try {
          responseObject.result = await sendTx(call.id, 'balances', 'transfer', [call.params[0], call.params[1]])
        } catch (err) {
          utils.logError('failed to send transaction', call.id, 'send-handler.transferAvt.sendTx', err)
          responseObject.error = { code: -32603, message: 'Internal error' }
        }
      } else {
        utils.logError('invalid params', call.id, 'send-handler.transferAvt.params', call.params)
        responseObject.error = { code: -32602, message: 'Invalid params' }
      }
      break

    case 'proxy':
      let pallet = call.params.pallet
      let method = call.params.method

      let formatter = codeFormatters[pallet][method]

      if (!formatter) {
        utils.logError('method not found', call.id, 'send-handler.proxy.method', call)
        responseObject.error = { code: -32601, message: 'Method not found' }
      } else if (!formatter.validate(call)) {
        utils.logError('invalid params', call.id, 'send-handler.proxy.params', call.params)
        responseObject.error = { code: -32602, message: 'Invalid params' }
      } else {
        try {
          let proof = {
            signer: call.params.innerArgs.from,
            relayer: call.params.relayer,
            signature: {
              Sr25519: call.params.signature
            }
          }
          responseObject.result = await sendProxyTx(
            call.id,
            pallet,
            method,
            formatter.encode(proof, call.params.innerArgs)
          )
        } catch (err) {
          utils.logError('failed to send proxy transaction', call.id, 'send-handler.proxy.sendProxyTx', err)
          responseObject.error = { code: -32603, message: 'Internal error' }
        }
      }
      break

    default:
      utils.logError('method not found', call.id, 'send-handler.callSwitch.default', method)
      responseObject.error = { code: -32601, message: 'Method not found' }
  }
  return responseObject
}

const codeFormatters = {
  balances: {
    transfer: {
      validate: function(params0, params1) {
        return utils.isValidAccountId(params0) && utils.isValidAmount(params1)
      },
      encode: function(params0, params1) {
        return [params0, params1]
      }
    }
  },
  tokenManager: {
    signedTransfer: {
      validate: function(call) {
        return (
          utils.isValidAccountId(call.params.relayer) &&
          utils.isValidAccountId(call.params.innerArgs.from) &&
          utils.isValidAccountId(call.params.innerArgs.to) &&
          utils.isValidTokenId(call.params.innerArgs.token) &&
          utils.isValidAmount(call.params.innerArgs.amount.toString())
        )
      },
      encode: function(proof, innerArgs) {
        return [proof, innerArgs.from, innerArgs.to, innerArgs.token, innerArgs.amount]
      }
    }
  }
}

// async function testlocal() {
//   console.log('transferAvt:', await processRequest('{"jsonrpc": "2.0", "method":"transferAvt", "params":["5DAgxVxKmnJ7hfhDEB9UetZm4jR2MPjGZGrmJZjirSVJDdMr", "2"], "id":5}'));
// }
//
// testlocal();
