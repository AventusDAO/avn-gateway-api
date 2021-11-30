const utils = require('../layer/nodejs/utils.js')
const axios = require('axios')
const MQSender = require('./mqSender.js')

const AVN_CONNECTOR_ENDPOINT = process.env.AVN_CONNECTOR_ENDPOINT

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
    case 'proxyAvtTransfer':
    case 'proxyTokenTransfer':
      await processProxyTransfer(call, responseObject, requestId)
      break
    case 'proxyMintSingleNft':
      await processProxyMintSingleNft(call, responseObject, requestId)
      break
    default:
      utils.logError('method not found', call.id, 'send-handler.callSwitch.default', method)
      responseObject.error = { code: -32601, message: 'Method not found' }
  }
  return responseObject
}

async function processProxyTransfer(call, responseObject, requestId) {
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
    utils.isValidEthereumAddress(token) &&
    utils.isValidAmount(amount) &&
    utils.isValidNonce(paymentNonce) &&
    utils.isValidSignatureFormat(proxyTransferSignature) &&
    utils.isValidSignatureFormat(feePaymentSignature)

  if (!validParams) {
    utils.logError('invalid params', call.id, 'send-handler.proxyTransfer.params', call.params)
    responseObject.error = { code: -32602, message: 'Invalid params' }
    return
  }

  const proxyProof = getProxyProof(signer, relayer, proxyTransferSignature)

  let relayerFee
  try {
    relayerFee = await getRelayerFees(relayer, signer, transactionType)
  } catch (err) {
    utils.logError('failed to retrieve relayer fee', call.id, 'send-handler.proxyTransfer.relayerFees', err)
    responseObject.error = { code: -32603, message: 'Internal error' }
    return
  }

  const paymentInfo = getPaymentInfo(signer, relayer, relayerFee, proxyProof, feePaymentSignature, paymentNonce)
  if (paymentInfo) {
    const params = {
      proxyParams: [proxyProof, signer, recipient, token, amount],
      relayerAddress: relayer,
      paymentInfo
    }

    try {
      responseObject.result = await sendTx(requestId, 'avnProxy', process.env.MQ_AVN_TX_QUEUE, pallet, method, params)
    } catch (err) {
      utils.logError('failed to send proxy transaction', call.id, 'send-handler.proxyTransfer.sendProxyTx', err)
      responseObject.error = { code: -32603, message: 'Internal error' }
    }
  } else {
    utils.logError('invalid fee authorisation', call.id, 'send-handler.proxyTransfer.verifyFeePaymentSignature', feePaymentSignature)
    responseObject.error = { code: -32602, message: 'Invalid params' }
  }
}

async function processProxyMintSingleNft(call, responseObject, requestId) {
  const transactionType = call.method
  const pallet = call.params.pallet
  const method = call.params.method
  const relayer = call.params.relayer
  const signer = call.params.signer
  const externalRef = call.params.externalRef
  const royalties = call.params.royalties
  const t1Authority = call.params.t1Authority
  const proxyMintSignature = call.params.proxyMintSignature
  const feePaymentSignature = call.params.feePaymentSignature
  const paymentNonce = call.params.paymentNonce

  const validParams =
    utils.isValidAccountId(relayer) &&
    utils.isValidAccountId(signer) &&
    !utils.isNullOrEmptyString(externalRef) &&
    utils.isValidEthereumAddress(t1Authority) &&
    utils.isValidArray(royalties) &&
    utils.isValidNonce(paymentNonce) &&
    utils.isValidSignatureFormat(proxyMintSignature) &&
    utils.isValidSignatureFormat(feePaymentSignature)

  if (!validParams) {
    utils.logError('invalid params', call.id, 'send-handler.proxyMintSingleNft.params', call.params)
    responseObject.error = { code: -32602, message: 'Invalid params' }
    return
  }

  const proxyProof = getProxyProof(signer, relayer, proxyMintSignature)

  let relayerFee
  try {
    relayerFee = await getRelayerFees(relayer, signer, transactionType)
  } catch (err) {
    utils.logError('failed to retrieve relayer fee', call.id, 'send-handler.proxyMintSingleNft.relayerFees', err)
    responseObject.error = { code: -32603, message: 'Internal error' }
    return
  }

  const paymentInfo = getPaymentInfo(signer, relayer, relayerFee, proxyProof, feePaymentSignature, paymentNonce)
  if (paymentInfo) {
    const params = {
      proxyParams: [proxyProof, signer, externalRef, royalties, t1Authority],
      relayerAddress: relayer,
      paymentInfo
    }

    try {
      responseObject.result = await sendTx(requestId, 'avnProxy', process.env.MQ_AVN_TX_QUEUE, pallet, method, params)
    } catch (err) {
      utils.logError('failed to send proxy transaction', call.id, 'send-handler.proxyMintSingleNft.sendProxyTx', err)
      responseObject.error = { code: -32603, message: 'Internal error' }
    }
  } else {
    utils.logError('invalid fee authorisation', call.id, 'send-handler.proxyMintSingleNft.verifyFeePaymentSignature', feePaymentSignature)
    responseObject.error = { code: -32602, message: 'Invalid params' }
  }
}

async function getRelayerFees(relayer, signer, transactionType) {
  const response = await axios.post(AVN_CONNECTOR_ENDPOINT + 'relayerFees', {
    relayer,
    user: signer,
    transactionType
  })
  return response.data[transactionType]
}

function getPaymentInfo(signer, relayer, relayerFee, proxyProof, feePaymentSignature, paymentNonce) {
  const paymentIsAuthorised = utils.verifyFeePaymentSignature(signer, relayer, relayerFee, proxyProof, feePaymentSignature, paymentNonce)

  if (!paymentIsAuthorised) {
    return undefined
  }

  return {
    recipient: relayer,
    amount: relayerFee,
    signature: {
      Sr25519: feePaymentSignature
    }
  }
}

function getProxyProof(signer, relayer, proxySignature) {
  return {
    signer,
    relayer,
    signature: {
      Sr25519: proxySignature
    }
  }
}
