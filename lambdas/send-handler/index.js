const utils = require('../layer/nodejs/utils.js')
const MQSender = require('./mqSender.js')

// TODO: SYS-1546 To check if this needs an update after we setup the k8t proxy
let mqSender
const connectToMQ = async () => {
  if (!mqSender || !mqSender.amqpConnection || !mqSender.amqpConnected) {
    mqSender = new MQSender(
      process.env.SECRET_MANAGER_REGION,
      process.env.MQ_SECRET_ARN,
      process.env.MQ_BROKER_AMQP_ENDPOINT
    )
    await mqSender.connectToMessageBroker()
  }
}

exports.handler = async (event, context) => {
  try {
    await connectToMQ()
    return {
      statusCode: 200,
      body: JSON.stringify(await processRequest(event.body, context.awsRequestId))
    }
  } catch (err) {
    return {
      statusCode: 500,
      error: { message: err.message },
      body: JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32603, message: 'Internal error' } })
    }
  }
}

async function sendTx(requestId, txType, queueName, palletName, method, params) {
  try {
    return await mqSender.sendMessageToMQ(queueName, { requestId, txType, palletName, method, params })
  } catch (err) {
    throw err
  }
}

async function processRequest(requestObject, requestId) {
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

  console.info('CALLID_REQUESTID:', call.id + ':' + requestId)

  if (typeof call.method !== 'string') {
    utils.logError('method type must be string', call.id, 'send-handler.processRequest.method', call.method)
    responseObject.error = { code: -32600, message: 'Invalid Request' }
  } else {
    responseObject = await callSwitch(call, responseObject, requestId)
  }

  responseObject.id = call.id
  return responseObject
}

async function callSwitch(call, responseObject, requestId) {
  switch (call.method) {
    case 'transferAvt':
      if (utils.isValidAccountId(call.params[0]) && utils.isValidAmount(call.params[1])) {
        try {
          responseObject.result = await sendTx(
            requestId,
            'avnTx',
            process.env.MQ_AVN_TX_QUEUE,
            'balances',
            'transfer',
            [call.params[0], call.params[1]]
          )
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

          let params = {
            proxyParams: [proof, innerArgs.from, innerArgs.to, innerArgs.token, innerArgs.amount],
            gatewayPaymentDetails: {
              signer: call.params.innerArgs.from,
              relayer: call.params.relayer,
              proxyProof: proof,
              feeSignature: call.params.gatewayFeeSignature,
              paymentNonce: call.params.paymentNonce
            }
          }

          responseObject.result = await sendTx(
            requestId,
            'avnProxy',
            process.env.MQ_AVN_TX_QUEUE,
            pallet,
            method,
            params
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
          utils.isValidAmount(call.params.innerArgs.amount.toString()) &&
          utils.isValidNonce(call.params.paymentNonce.toString()) &&
          !utils.isNullOrEmptyString(call.params.gatewayFeeSignature)
        )
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
