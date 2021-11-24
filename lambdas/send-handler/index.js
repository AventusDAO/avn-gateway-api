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

    case 'proxyAvtTransfer':
    case 'proxyTokenTransfer':
      const transactionType = call.method
      const pallet = call.params.pallet
      const method = call.params.method
      const relayer = call.params.relayer
      const signer = call.params.signer
      const recipient = call.params.recipient
      const token = call.params.token
      const amount = call.params.amount
      const proxyTransferSignature = call.params.proxyTransferSignature
      const feePaymentSignature = call.params.feePaymentSignature
      const paymentNonce = call.params.paymentNonce

      const validParams =
        utils.isValidAccountId(relayer) &&
        utils.isValidAccountId(signer) &&
        utils.isValidAccountId(recipient) &&
        utils.isValidTokenId(token) &&
        utils.isValidAmount(amount) &&
        utils.isValidNonce(paymentNonce) &&
        utils.isValidSignatureFormat(proxyTransferSignature) &&
        utils.isValidSignatureFormat(feePaymentSignature)

      if (!validParams) {
        utils.logError('invalid params', call.id, 'send-handler.proxyTransfer.params', call.params)
        responseObject.error = { code: -32602, message: 'Invalid params' }
      } else {
        const proxyProof = {
          signer,
          relayer,
          signature: {
            Sr25519: proxyTransferSignature
          }
        }

        const relayerFee = (
          await axios.post(AVN_CONNECTOR_ENDPOINT + 'relayerFees', { relayer, signer, transactionType })
        ).data

        const paymentInfo = {
          recipient: relayer,
          amount: relayerFee,
          signature: {
            Sr25519: feePaymentSignature
          }
        }

        const paymentIsAuthorised = utils.verifyFeePaymentAuthorisation(
          signer,
          relayer,
          fee,
          proxyProof,
          feePaymentSignature,
          paymentNonce
        )

        if (paymentIsAuthorised) {
          const params = {
            proxyParams: [proxyProof, signer, recipient, token, amount],
            paymentInfo
          }

          try {
            responseObject.result = await sendTx(
              requestId,
              'avnProxy',
              process.env.MQ_AVN_TX_QUEUE,
              pallet,
              method,
              params
            )
          } catch (err) {
            utils.logError('failed to send proxy transaction', call.id, 'send-handler.proxyTransfer.sendProxyTx', err)
            responseObject.error = { code: -32603, message: 'Internal error' }
          }
        } else {
          utils.logError(
            'invalid fee authorisation',
            call.id,
            'send-handler.proxyTransfer.verifyPaymentAuthorisation',
            feePaymentSignature
          )
          responseObject.error = { code: -32602, message: 'Invalid params' }
        }
      }
      break

    default:
      utils.logError('method not found', call.id, 'send-handler.callSwitch.default', method)
      responseObject.error = { code: -32601, message: 'Method not found' }
  }
  return responseObject
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
