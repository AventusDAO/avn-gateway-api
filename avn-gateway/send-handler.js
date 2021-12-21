const utils = require('/opt/utils.js')
const MQSender = require('/opt/mqSender.js')

const AVN_CONNECTOR_ENDPOINT = process.env.AVN_CONNECTOR_ENDPOINT

let mqSender

exports.handler = async (event, context) => {
  try {
    await connectToMQ()
    return {
      statusCode: 200,
      body: JSON.stringify(await processRequest(event.body, context.awsRequestId))
    }
  } catch (err) {
    const gatewayError = 'failed to connect to queue'
    utils.logError(gatewayError, null, err)
    const body = {
      jsonrpc: '2.0',
      id: null,
      error: { code: -32603, message: 'Internal error', data: { gatewayError, request: event.body } }
    }
    return {
      statusCode: 500,
      error: { message: err.message },
      body: JSON.stringify(body)
    }
  }
}

const connectToMQ = async () => {
  if (!mqSender || !mqSender.amqpConnection || !mqSender.amqpConnected) {
    mqSender = new MQSender(process.env.SECRET_MANAGER_REGION, process.env.MQ_SECRET_ARN, process.env.MQ_BROKER_AMQP_ENDPOINT)
    await mqSender.connectToMessageBroker()
  }
}

async function processRequest(request, requestId) {
  let response = { jsonrpc: '2.0' }
  let call

  try {
    call = JSON.parse(request)
  } catch (err) {
    const gatewayError = 'failed to parse JSON'
    utils.logError(gatewayError, null, err)
    response.error = { code: -32700, message: 'Parse error', data: { gatewayError, request } }
    response.id = null
    return response
  }

  console.info('CALLID_TO_REQUESTID:', call.id + ':' + requestId)

  if (typeof call.method !== 'string') {
    const gatewayError = 'method type must be string'
    utils.logError(gatewayError, call.id, call.method)
    response.error = { code: -32600, message: 'Invalid Request', data: { gatewayError, request } }
  } else {
    await callSwitch(call, request, response, requestId)
  }

  response.id = call.id
  return response
}

async function callSwitch(call, request, response, requestId) {
  switch (call.method) {
    case 'proxyAvtTransfer':
    case 'proxyTokenTransfer':
      await processProxyTransfer(call, request, response, requestId)
      break
    case 'proxyCancelListFiatNft':
      await processProxyCancelListFiatNft(call, request, response, requestId)
      break
    case 'proxyListNftOpenForSale':
      await processProxyListNftOpenForSale(call, request, response, requestId)
      break
    case 'proxyMintSingleNft':
      await processProxyMintSingleNft(call, request, response, requestId)
      break
    case 'proxyTransferFiatNft':
      await processProxyTransferFiatNft(call, request, response, requestId)
      break
    default:
      const gatewayError = 'method not found'
      utils.logError(gatewayError, call.id, call.method)
      response.error = { code: -32601, message: 'Method not found', data: { gatewayError, request } }
  }
}

async function sendTx(request, response, callId, requestId, palletName, method, params) {
  try {
    const queue = process.env.MQ_AVN_TX_QUEUE
    const txType = 'avnProxy'
    const queueResponse = await mqSender.sendMessageToMQ(queue, { requestId, txType, palletName, method, params })
    response.result = queueResponse
  } catch (err) {
    const gatewayError = 'failed to send proxy transaction'
    utils.logError(gatewayError, callId, err)
    response.error = { code: -32603, message: 'Internal error', data: { gatewayError, request } }
  }
}

async function processProxyTransfer(call, request, response, requestId) {
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

  try {
    if (utils.isValidAccountId(relayer) === false) throw 'relayer'
    if (utils.isValidAccountId(signer) === false) throw 'signer'
    if (utils.isValidAccountId(recipient) === false) throw 'recipient'
    if (utils.isValidEthereumAddress(token) === false) throw 'token'
    if (utils.isValidAmount(amount) === false) throw 'amount'
    if (utils.isValidNonce(paymentNonce) === false) throw 'payment nonce'
    if (utils.isValidSignatureFormat(proxyTransferSignature) === false) throw 'proxy signature format'
    if (utils.isValidSignatureFormat(feePaymentSignature) === false) throw 'fee signature format'
  } catch (param) {
    const gatewayError = 'invalid ' + param
    utils.logError(gatewayError, call.id, call.params)
    response.error = { code: -32602, message: 'Invalid params', data: { gatewayError, request } }
    return
  }

  const proxyProof = getProxyProof(signer, relayer, proxyTransferSignature)

  const relayerFee = await getRelayerFee(request, response, call.id, relayer, signer, transactionType)

  if (!relayerFee) {
    return
  }

  const paymentInfo = getPaymentInfo(
    request,
    response,
    call.id,
    signer,
    relayer,
    relayerFee,
    proxyProof,
    feePaymentSignature,
    paymentNonce
  )

  if (paymentInfo) {
    const params = {
      proxyParams: [proxyProof, signer, recipient, token, amount],
      relayerAddress: relayer,
      paymentInfo
    }
    await sendTx(request, response, call.id, requestId, pallet, method, params)
  }
}

async function processProxyCancelListFiatNft(call, request, response, requestId) {
  const transactionType = call.method

  const { pallet, method, relayer, signer, nftId, proxyCancelListFiatNftSignature, feePaymentSignature, paymentNonce } =
    call.params

  try {
    if (utils.isValidAccountId(relayer) === false) throw 'relayer'
    if (utils.isValidAccountId(signer) === false) throw 'signer'
    if (utils.isValidNftId(nftId) === false) throw 'nft ID'
    if (utils.isValidNonce(paymentNonce) === false) throw 'payment nonce'
    if (utils.isValidSignatureFormat(proxyCancelListFiatNftSignature) === false) throw 'proxy signature format'
    if (utils.isValidSignatureFormat(feePaymentSignature) === false) throw 'fee signature format'
  } catch (param) {
    const gatewayError = 'invalid ' + param
    utils.logError(gatewayError, call.id, call.params)
    response.error = { code: -32602, message: 'Invalid params', data: { gatewayError, request } }
    return
  }

  const proxyProof = getProxyProof(signer, relayer, proxyCancelListFiatNftSignature)

  const relayerFee = await getRelayerFee(request, response, call.id, relayer, signer, transactionType)

  if (!relayerFee) {
    return
  }

  const paymentInfo = getPaymentInfo(
    request,
    response,
    call.id,
    signer,
    relayer,
    relayerFee,
    proxyProof,
    feePaymentSignature,
    paymentNonce
  )

  if (paymentInfo) {
    const params = {
      proxyParams: [proxyProof, nftId],
      relayerAddress: relayer,
      paymentInfo
    }
    await sendTx(request, response, call.id, requestId, pallet, method, params)
  }
}

async function processProxyListNftOpenForSale(call, request, response, requestId) {
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

  try {
    if (utils.isValidAccountId(relayer) === false) throw 'relayer'
    if (utils.isValidAccountId(signer) === false) throw 'signer'
    if (utils.isValidNftId(nftId) === false) throw 'nft ID'
    if (utils.isValidMarket(market) === false) throw 'market'
    if (utils.isValidNonce(paymentNonce) === false) throw 'payment nonce'
    if (utils.isValidSignatureFormat(proxyListNftOpenForSaleSignature) === false) throw 'proxy signature'
    if (utils.isValidSignatureFormat(feePaymentSignature) === false) throw 'fee signature format'
  } catch (param) {
    const gatewayError = 'invalid ' + param
    utils.logError(gatewayError, call.id, call.params)
    response.error = { code: -32602, message: 'Invalid params', data: { gatewayError, request } }
    return
  }

  const proxyProof = getProxyProof(signer, relayer, proxyListNftOpenForSaleSignature)

  const relayerFee = await getRelayerFee(request, response, call.id, relayer, signer, transactionType)

  if (!relayerFee) {
    return
  }

  const paymentInfo = getPaymentInfo(
    request,
    response,
    call.id,
    signer,
    relayer,
    relayerFee,
    proxyProof,
    feePaymentSignature,
    paymentNonce
  )

  if (paymentInfo) {
    const params = {
      proxyParams: [proxyProof, nftId, market],
      relayerAddress: relayer,
      paymentInfo
    }
    await sendTx(request, response, call.id, requestId, pallet, method, params)
  }
}

async function processProxyMintSingleNft(call, request, response, requestId) {
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

  try {
    if (utils.isValidAccountId(relayer) === false) throw 'relayer'
    if (utils.isValidAccountId(signer) === false) throw 'signer'
    if (utils.isValidString(externalRef) === false) throw 'externalRef'
    if (utils.isValidEthereumAddress(t1Authority) === false) throw 't1Authority'
    if (utils.isValidArray(royalties) === false) throw 'royalties'
    if (utils.isValidNonce(paymentNonce) === false) throw 'payment nonce'
    if (utils.isValidSignatureFormat(proxyMintSignature) === false) throw 'proxy signature format'
    if (utils.isValidSignatureFormat(feePaymentSignature) === false) throw 'fee signature format'
  } catch (param) {
    const gatewayError = 'invalid ' + param
    utils.logError(gatewayError, call.id, call.params)
    response.error = { code: -32602, message: 'Invalid params', data: { gatewayError, request } }
    return
  }

  const proxyProof = getProxyProof(signer, relayer, proxyMintSignature)

  const relayerFee = await getRelayerFee(request, response, call.id, relayer, signer, transactionType)

  if (!relayerFee) {
    return
  }

  const paymentInfo = getPaymentInfo(
    request,
    response,
    call.id,
    signer,
    relayer,
    relayerFee,
    proxyProof,
    feePaymentSignature,
    paymentNonce
  )

  if (paymentInfo) {
    const params = {
      proxyParams: [proxyProof, externalRef, royalties, t1Authority],
      relayerAddress: relayer,
      paymentInfo
    }
    await sendTx(request, response, call.id, requestId, pallet, method, params)
  }
}

async function processProxyTransferFiatNft(call, request, response, requestId) {
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

  try {
    if (utils.isValidAccountId(relayer) === false) throw 'relayer'
    if (utils.isValidAccountId(signer) === false) throw 'signer'
    if (utils.isValidNftId(nftId) === false) throw 'nft ID'
    if (utils.isValidAccountId(recipient) === false) throw 'recipient'
    if (utils.isValidNonce(paymentNonce) === false) throw 'payment nonce'
    if (utils.isValidSignatureFormat(proxyTransferFiatNftSignature) === false) throw 'proxy signature format'
    if (utils.isValidSignatureFormat(feePaymentSignature) === false) throw 'fee signature format'
  } catch (param) {
    const gatewayError = 'invalid ' + param
    utils.logError(gatewayError, call.id, call.params)
    response.error = { code: -32602, message: 'Invalid params', data: { gatewayError, request } }
    return
  }

  const proxyProof = getProxyProof(signer, relayer, proxyTransferFiatNftSignature)

  const relayerFee = await getRelayerFee(request, response, call.id, relayer, signer, transactionType)

  if (!relayerFee) {
    return
  }

  const paymentInfo = getPaymentInfo(
    request,
    response,
    call.id,
    signer,
    relayer,
    relayerFee,
    proxyProof,
    feePaymentSignature,
    paymentNonce
  )

  if (paymentInfo) {
    const params = {
      proxyParams: [proxyProof, nftId, recipient],
      relayerAddress: relayer,
      paymentInfo
    }
    await sendTx(request, response, call.id, requestId, pallet, method, params)
  }
}

async function getRelayerFee(request, response, callId, relayer, user, transactionType) {
  try {
    const avnResponse = await utils.axios.post(AVN_CONNECTOR_ENDPOINT + 'relayerFees', { relayer, user, transactionType })
    return avnResponse.data.toString()
  } catch (err) {
    const gatewayError = 'failed to retrieve relayer fee'
    utils.logError(gatewayError, callId, err)
    response.error = { code: -32603, message: 'Internal error', data: { gatewayError, request } }
    return undefined
  }
}

function getPaymentInfo(request, response, callId, signer, relayer, relayerFee, proxyProof, feePaymentSignature, paymentNonce) {
  const paymentIsAuthorised = utils.verifyFeePaymentSignature(
    signer,
    relayer,
    relayerFee,
    proxyProof,
    feePaymentSignature,
    paymentNonce
  )

  if (!paymentIsAuthorised) {
    const gatewayError = 'invalid fee authorisation'
    utils.logError(gatewayError, callId, feePaymentSignature)
    response.error = { code: -32602, message: 'Invalid params', data: { gatewayError, request } }
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
