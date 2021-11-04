const utils = require('../common/utils.js')
const EC2 = require('../common/resources.json').ec2_endpoint
const axios = require('axios')
const MQSender = require('./mqSender.js')

// TODO: SYS-1546 To check if this needs an update after we setup the k8t proxy
let mqSender
let userRequestId
const connectToMQ = async () => {
  if (!mqSender || !mqSender.amqpConnection) {
    mqSender = new MQSender(
      process.env.SECRET_MANAGER_REGION,
      process.env.MQ_SECRET_ARN,
      process.env.MQ_BROKER_AMQP_ENDPOINT
    )
    await mqSender.connectToMessageBroker()
  }
}

exports.handler = async event => {
  try {
    await connectToMQ()
    return {
      statusCode: 200,
      body: JSON.stringify(await processRequest(event.body))
    }
  } catch (err) {
    return {
      statusCode: 500,
      error: { message: err.message }
    }
  }
}

async function sendTx(txType, queueName, palletName, method, params) {
  try {
    return await mqSender.sendMessageToMQ(queueName, { userRequestId, txType, palletName, method, params })
  } catch (err) {
    throw err
  }
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

  userRequestId = call.id

  if (typeof call.method !== 'string') {
    utils.logError('method type must be string', userRequestId, 'send-handler.processRequest.method', call.method)
    responseObject.error = { code: -32600, message: 'Invalid Request' }
  } else {
    responseObject = await callSwitch(call, responseObject)
  }

  responseObject.id = userRequestId
  return responseObject
}

async function callSwitch(call, responseObject) {
  switch (call.method) {
    case 'transferAvt':
      if (utils.isValidAccountId(call.params[0]) && utils.isValidAmount(call.params[1])) {
        try {
          responseObject.result = await sendTx('avnTx', process.env.MQ_AVN_TX_QUEUE, 'balances', 'transfer', [
            call.params[0],
            call.params[1]
          ])
        } catch (err) {
          utils.logError('failed to send transaction', userRequestId, 'send-handler.transferAvt.sendTx', err)
          responseObject.error = { code: -32603, message: 'Internal error' }
        }
      } else {
        utils.logError('invalid params', userRequestId, 'send-handler.transferAvt.params', call.params)
        responseObject.error = { code: -32602, message: 'Invalid params' }
      }
      break

    case 'proxy':
      let pallet = call.params.pallet
      let method = call.params.method

      let formatter = codeFormatters[pallet][method]

      if (!formatter) {
        utils.logError('method not found', userRequestId, 'send-handler.proxy.method', call)
        responseObject.error = { code: -32601, message: 'Method not found' }
      } else if (!formatter.validate(call)) {
        utils.logError('invalid params', userRequestId, 'send-handler.proxy.params', call.params)
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
          responseObject.result = await sendTx('avnProxy', pallet, method, formatter.encode(proof, call.params.innerArgs))
        } catch (err) {
          utils.logError('failed to send proxy transaction', userRequestId, 'send-handler.proxy.sendProxyTx', err)
          responseObject.error = { code: -32603, message: 'Internal error' }
        }
      }
      break

    default:
      utils.logError('method not found', userRequestId, 'send-handler.callSwitch.default', method)
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

// async function testlocal(n) {
//   await connectToMQ()
//   for (var i = 0; i < n; i++) {
//     console.info('transferAvt:', await processRequest(`{"jsonrpc": "2.0", "method":"transferAvt", "params":["5DAgxVxKmnJ7hfhDEB9UetZm4jR2MPjGZGrmJZjirSVJDdMr", "2"], "id":${i}}`))
//     await sleep(1000)
//   }
// }

// function sleep(ms) {
//   return new Promise((resolve, reject) => setTimeout(resolve, ms) )
// }

// testlocal(1)
