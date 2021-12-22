const utils = require('/opt/utils.js')
const MQSender = require('/opt/mqSender.js')

const AVN_CONNECTOR_ENDPOINT = process.env.AVN_CONNECTOR_ENDPOINT

let mqSender

exports.handler = async (event, context) => {
  let response = { jsonrpc: '2.0', id: null }

  try {
    await connectToMQ()
  } catch (err) {
    return {
      statusCode: 500,
      error: { message: err.message },
      body: JSON.stringify(utils.errorResponse('parse', 'failed to connect to queue', err, event.body, response))
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify(await processRequest(event.body, response, context.awsRequestId))
  }
}

const connectToMQ = async () => {
  if (!mqSender || !mqSender.amqpConnection || !mqSender.amqpConnected) {
    mqSender = new MQSender(process.env.SECRET_MANAGER_REGION, process.env.MQ_SECRET_ARN, process.env.MQ_BROKER_AMQP_ENDPOINT)
    await mqSender.connectToMessageBroker()
  }
}

async function processRequest(request, response, requestId) {
  let call

  try {
    call = JSON.parse(request)
  } catch (err) {
    return utils.errorResponse('parse', 'failed to parse JSON', err, request, response)
  }

  console.info('CALLID_TO_REQUESTID:', call.id + ':' + requestId)
  response.id = call.id

  if (typeof call.method !== 'string') {
    return utils.errorResponse('request', 'method type must be string', call.method, request, response)
  } else {
    return await callSwitch(call, request, response, requestId)
  }
}

async function callSwitch(call, request, response, requestId) {
  switch (call.method) {
    case 'proxyAvtTransfer':
    case 'proxyTokenTransfer':
      return await processProxyTransfer(call, request, response, requestId)
    case 'proxyCancelListFiatNft':
      return await processProxyCancelListFiatNft(call, request, response, requestId)
    case 'proxyListNftOpenForSale':
      return await processProxyListNftOpenForSale(call, request, response, requestId)
    case 'proxyMintSingleNft':
      return await processProxyMintSingleNft(call, request, response, requestId)
    case 'proxyTransferFiatNft':
      return await processProxyTransferFiatNft(call, request, response, requestId)
    default:
      return utils.errorResponse(2, 'method not found', call.method, request, response)
  }
}

async function sendTx(request, response, callId, requestId, palletName, method, params) {
  try {
    const queue = process.env.MQ_AVN_TX_QUEUE
    const txType = 'avnProxy'
    response.result = await mqSender.sendMessageToMQ(queue, { requestId, txType, palletName, method, params })
    return response
  } catch (err) {
    return utils.errorResponse('internal', 'failed to send proxy transaction', err, request, response)
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
    return utils.errorResponse('params', gatewayError, call.params, request, response)
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
    return await sendTx(request, response, call.id, requestId, pallet, method, params)
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
    return utils.errorResponse('params', gatewayError, call.params, request, response)
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
    return await sendTx(request, response, call.id, requestId, pallet, method, params)
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
    return utils.errorResponse('params', gatewayError, call.params, request, response)
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
    return await sendTx(request, response, call.id, requestId, pallet, method, params)
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
    return utils.errorResponse('params', gatewayError, call.params, request, response)
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
    return await sendTx(request, response, call.id, requestId, pallet, method, params)
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
    return utils.errorResponse('params', gatewayError, call.params, request, response)
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
    return await sendTx(request, response, call.id, requestId, pallet, method, params)
  }
}

async function getRelayerFee(request, response, callId, relayer, user, transactionType) {
  try {
    const avnResponse = await utils.axios.post(AVN_CONNECTOR_ENDPOINT + 'relayerFees', { relayer, user, transactionType })
    return avnResponse.data.toString()
  } catch (err) {
    // return utils.errorResponse('internal', 'failed to retrieve relayer fee', err, request, response)
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
    // return utils.errorResponse('params', 'invalid fee authorisation', feePaymentSignature, request, response)
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
