const utils = require('../layer/nodejs/utils.js')
const MQSender = require('./mqSender.js')

const AVN_CONNECTOR_ENDPOINT = process.env.AVN_CONNECTOR_ENDPOINT

// TODO: SYS-1546 To check if this needs an update after we setup the k8t proxy
let mqSender
const connectToMQ = async () => {
  if (!mqSender || !mqSender.amqpConnection || !mqSender.amqpConnected) {
    mqSender = new MQSender(process.env.SECRET_MANAGER_REGION, process.env.MQ_SECRET_ARN, process.env.MQ_BROKER_AMQP_ENDPOINT)
    await mqSender.connectToMessageBroker()
  }
}

exports.handler = async (event, context) => {
  await utils.init()
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
    case 'proxyListNftOpenForSale':
      await processProxyListNftOpenForSale(call, responseObject, requestId)
      break
    case 'proxyTransferFiatNft':
      await processProxyTransferFiatNft(call, responseObject, requestId)
      break
    case 'proxyCancelListFiatNft':
      await processProxyCancelListFiatNft(call, responseObject, requestId)
      break
    default:
      utils.logError('method not found', call.id, 'send-handler.callSwitch.default', call.method)
      responseObject.error = { code: -32601, message: 'Method not found' }
  }
  return responseObject
}

async function processProxyTransfer(call, responseObject, requestId) {
  const transactionType = call.method
  const {
    pallet,
    method,
    relayer,
    signer,
    recipient,
    token,
    amount,
    proxyTransferSignature,
    feePaymentSignature,
    paymentNonce
  } = call.params

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
    utils.logError(
      'invalid fee authorisation',
      call.id,
      'send-handler.proxyTransfer.verifyFeePaymentSignature',
      feePaymentSignature
    )
    responseObject.error = { code: -32602, message: 'Invalid params' }
  }
}

async function processProxyListNftOpenForSale(call, responseObject, requestId) {
  const transactionType = call.method
  const {
    pallet,
    method,
    relayer,
    signer,
    nftId,
    market,
    proxyListNftOpenForSaleSignature,
    feePaymentSignature,
    paymentNonce
  } = call.params

  const validParams =
    utils.isValidAccountId(relayer) &&
    utils.isValidAccountId(signer) &&
    utils.isValidNftId(nftId) &&
    utils.isValidMarket(market) &&
    utils.isValidNonce(paymentNonce) &&
    utils.isValidSignatureFormat(proxyListNftOpenForSaleSignature) &&
    utils.isValidSignatureFormat(feePaymentSignature)

  if (!validParams) {
    utils.logError('invalid params', call.id, 'send-handler.proxyListNftOpenForSale.params', call.params)
    responseObject.error = { code: -32602, message: 'Invalid params' }
    return
  }

  const proxyProof = getProxyProof(signer, relayer, proxyListNftOpenForSaleSignature)

  let relayerFee
  try {
    relayerFee = await getRelayerFees(relayer, signer, transactionType)
  } catch (err) {
    utils.logError('failed to retrieve relayer fee', call.id, 'send-handler.proxyListNftOpenForSale.relayerFees', err)
    responseObject.error = { code: -32603, message: 'Internal error' }
    return
  }

  const paymentInfo = getPaymentInfo(signer, relayer, relayerFee, proxyProof, feePaymentSignature, paymentNonce)
  if (paymentInfo) {
    const params = {
      proxyParams: [proxyProof, nftId, market],
      relayerAddress: relayer,
      paymentInfo
    }

    try {
      responseObject.result = await sendTx(requestId, 'avnProxy', process.env.MQ_AVN_TX_QUEUE, pallet, method, params)
    } catch (err) {
      utils.logError('failed to send proxy transaction', call.id, 'send-handler.proxyListNftOpenForSale.sendProxyTx', err)
      responseObject.error = { code: -32603, message: 'Internal error' }
    }
  } else {
    utils.logError(
      'invalid fee authorisation',
      call.id,
      'send-handler.proxyListNftOpenForSale.verifyFeePaymentSignature',
      feePaymentSignature
    )
    responseObject.error = { code: -32602, message: 'Invalid params' }
  }
}

async function processProxyMintSingleNft(call, responseObject, requestId) {
  const transactionType = call.method
  const {
    pallet,
    method,
    relayer,
    signer,
    externalRef,
    royalties,
    t1Authority,
    proxyMintSignature,
    feePaymentSignature,
    paymentNonce
  } = call.params

  const validParams =
    utils.isValidAccountId(relayer) &&
    utils.isValidAccountId(signer) &&
    utils.isValidString(externalRef) &&
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
      proxyParams: [proxyProof, externalRef, royalties, t1Authority],
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
    utils.logError(
      'invalid fee authorisation',
      call.id,
      'send-handler.proxyMintSingleNft.verifyFeePaymentSignature',
      feePaymentSignature
    )
    responseObject.error = { code: -32602, message: 'Invalid params' }
  }
}

async function processProxyTransferFiatNft(call, responseObject, requestId) {
  const transactionType = call.method
  const {
    pallet,
    method,
    relayer,
    signer,
    nftId,
    recipient,
    proxyTransferFiatNftSignature,
    feePaymentSignature,
    paymentNonce
  } = call.params

  const validParams =
    utils.isValidAccountId(relayer) &&
    utils.isValidAccountId(signer) &&
    utils.isValidNftId(nftId) &&
    utils.isValidAccountId(recipient) &&
    utils.isValidNonce(paymentNonce) &&
    utils.isValidSignatureFormat(proxyTransferFiatNftSignature) &&
    utils.isValidSignatureFormat(feePaymentSignature)

  if (!validParams) {
    utils.logError('invalid params', call.id, 'send-handler.proxyTransferFiatNft.params', call.params)
    responseObject.error = { code: -32602, message: 'Invalid params' }
    return
  }

  const proxyProof = getProxyProof(signer, relayer, proxyTransferFiatNftSignature)

  let relayerFee
  try {
    relayerFee = await getRelayerFees(relayer, signer, transactionType)
  } catch (err) {
    utils.logError('failed to retrieve relayer fee', call.id, 'send-handler.proxyTransferFiatNft.relayerFees', err)
    responseObject.error = { code: -32603, message: 'Internal error' }
    return
  }

  const paymentInfo = getPaymentInfo(signer, relayer, relayerFee, proxyProof, feePaymentSignature, paymentNonce)
  if (paymentInfo) {
    const params = {
      proxyParams: [proxyProof, nftId, recipient],
      relayerAddress: relayer,
      paymentInfo
    }

    try {
      responseObject.result = await sendTx(requestId, 'avnProxy', process.env.MQ_AVN_TX_QUEUE, pallet, method, params)
    } catch (err) {
      utils.logError('failed to send proxy transaction', call.id, 'send-handler.proxyTransferFiatNft.sendProxyTx', err)
      responseObject.error = { code: -32603, message: 'Internal error' }
    }
  } else {
    utils.logError(
      'invalid fee authorisation',
      call.id,
      'send-handler.proxyTransferFiatNft.verifyFeePaymentSignature',
      feePaymentSignature
    )
    responseObject.error = { code: -32602, message: 'Invalid params' }
  }
}

async function processProxyCancelListFiatNft(call, responseObject, requestId) {
  const transactionType = call.method
  const { pallet, method, relayer, signer, nftId, proxyCancelListFiatNftSignature, feePaymentSignature, paymentNonce } =
    call.params

  const validParams =
    utils.isValidAccountId(relayer) &&
    utils.isValidAccountId(signer) &&
    utils.isValidNftId(nftId) &&
    utils.isValidNonce(paymentNonce) &&
    utils.isValidSignatureFormat(proxyCancelListFiatNftSignature) &&
    utils.isValidSignatureFormat(feePaymentSignature)

  if (!validParams) {
    utils.logError('invalid params', call.id, 'send-handler.proxyCancelListFiatNft.params', call.params)
    responseObject.error = { code: -32602, message: 'Invalid params' }
    return
  }

  const proxyProof = getProxyProof(signer, relayer, proxyCancelListFiatNftSignature)

  let relayerFee
  try {
    relayerFee = await getRelayerFees(relayer, signer, transactionType)
  } catch (err) {
    utils.logError('failed to retrieve relayer fee', call.id, 'send-handler.proxyCancelListFiatNft.relayerFees', err)
    responseObject.error = { code: -32603, message: 'Internal error' }
    return
  }

  const paymentInfo = getPaymentInfo(signer, relayer, relayerFee, proxyProof, feePaymentSignature, paymentNonce)
  if (paymentInfo) {
    const params = {
      proxyParams: [proxyProof, nftId],
      relayerAddress: relayer,
      paymentInfo
    }

    try {
      responseObject.result = await sendTx(requestId, 'avnProxy', process.env.MQ_AVN_TX_QUEUE, pallet, method, params)
    } catch (err) {
      utils.logError('failed to send proxy transaction', call.id, 'send-handler.proxyCancelListFiatNft.sendProxyTx', err)
      responseObject.error = { code: -32603, message: 'Internal error' }
    }
  } else {
    utils.logError(
      'invalid fee authorisation',
      call.id,
      'send-handler.proxyCancelListFiatNft.verifyFeePaymentSignature',
      feePaymentSignature
    )
    responseObject.error = { code: -32602, message: 'Invalid params' }
  }
}

async function getRelayerFees(relayer, signer, transactionType) {
  const response = await utils.axios.post(AVN_CONNECTOR_ENDPOINT + 'relayerFees', {
    relayer,
    user: signer,
    transactionType
  })
  return response.data.toString()
}

function getPaymentInfo(signer, relayer, relayerFee, proxyProof, feePaymentSignature, paymentNonce) {
  const paymentIsAuthorised = utils.verifyFeePaymentSignature(
    signer,
    relayer,
    relayerFee,
    proxyProof,
    feePaymentSignature,
    paymentNonce
  )

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
