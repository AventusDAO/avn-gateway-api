const utils = require('/opt/utils.js')
const MQSender = require('/opt/mqSender.js')

const AVN_CONNECTOR_ENDPOINT = process.env.AVN_CONNECTOR_ENDPOINT

let mqSender
const connectToMQ = async () => {
  if (!mqSender || !mqSender.amqpConnection || !mqSender.amqpConnected) {
    mqSender = new MQSender(process.env.SECRET_MANAGER_REGION, process.env.MQ_SECRET_ARN, process.env.MQ_BROKER_AMQP_ENDPOINT)
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

async function sendTx(responseObject, callId, requestId, txType, queueName, palletName, method, params) {
  let response
  try {
    response = await mqSender.sendMessageToMQ(queueName, { requestId, txType, palletName, method, params })
  } catch (err) {
    utils.logError('failed to send proxy transaction', callId, err)
    responseObject.error = { code: -32603, message: 'Internal error' }
  }

  responseObject.result = response
}

async function processRequest(requestObject, requestId) {
  let responseObject = { jsonrpc: '2.0' }
  let call

  try {
    call = JSON.parse(requestObject)
  } catch (err) {
    utils.logError('failed to parse JSON', null, err)
    responseObject.error = { code: -32700, message: 'Parse error' }
    responseObject.id = null
    return responseObject
  }

  console.info('CALLID_REQUESTID:', call.id + ':' + requestId)

  if (typeof call.method !== 'string') {
    utils.logError('method type must be string', call.id, call.method)
    responseObject.error = { code: -32600, message: 'Invalid Request' }
  } else {
    await callSwitch(call, responseObject, requestId)
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
      utils.logError('method not found', call.id, call.method)
      responseObject.error = { code: -32601, message: 'Method not found' }
  }
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
    const errorMsg = 'invalid ' + param
    utils.logError(errorMsg, call.id, call.params)
    responseObject.error = { code: -32602, message: 'Invalid params' }
    return
  }

  const proxyProof = getProxyProof(signer, relayer, proxyTransferSignature)

  const relayerFee = await getRelayerFee(responseObject, relayer, signer, transactionType)

  if (!relayerFee) {
    return
  }

  const paymentInfo = getPaymentInfo(responseObject, signer, relayer, relayerFee, proxyProof, feePaymentSignature, paymentNonce)

  if (paymentInfo) {
    const params = {
      proxyParams: [proxyProof, signer, recipient, token, amount],
      relayerAddress: relayer,
      paymentInfo
    }
  }

  await sendTx(responseObject, call.id, requestId, 'avnProxy', process.env.MQ_AVN_TX_QUEUE, pallet, method, params)
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

  try {
    if (utils.isValidAccountId(relayer) === false) throw 'relayer'
    if (utils.isValidAccountId(signer) === false) throw 'signer'
    if (utils.isValidNftId(nftId) === false) throw 'nft ID'
    if (utils.isValidMarket(market) === false) throw 'market'
    if (utils.isValidNonce(paymentNonce) === false) throw 'payment nonce'
    if (isValidSignatureFormat(proxyListNftOpenForSaleSignature) === false) throw 'proxy signature'
    if (utils.isValidSignatureFormat(feePaymentSignature) === false) throw 'fee signature format'
  } catch (param) {
    const errorMsg = 'invalid ' + param
    utils.logError(errorMsg, call.id, call.params)
    responseObject.error = { code: -32602, message: 'Invalid params' }
    return
  }

  const proxyProof = getProxyProof(signer, relayer, proxyListNftOpenForSaleSignature)

  const relayerFee = await getRelayerFee(responseObject, relayer, signer, transactionType)

  if (!relayerFee) {
    return
  }

  const paymentInfo = getPaymentInfo(responseObject, signer, relayer, relayerFee, proxyProof, feePaymentSignature, paymentNonce)

  if (paymentInfo) {
    const params = {
      proxyParams: [proxyProof, nftId, market],
      relayerAddress: relayer,
      paymentInfo
    }
  }

  await sendTx(responseObject, call.id, requestId, 'avnProxy', process.env.MQ_AVN_TX_QUEUE, pallet, method, params)
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
    const errorMsg = 'invalid ' + param
    utils.logError(errorMsg, call.id, call.params)
    responseObject.error = { code: -32602, message: 'Invalid params' }
    return
  }

  const proxyProof = getProxyProof(signer, relayer, proxyMintSignature)

  const relayerFee = await getRelayerFee(responseObject, relayer, signer, transactionType)

  if (!relayerFee) {
    return
  }

  const paymentInfo = getPaymentInfo(responseObject, signer, relayer, relayerFee, proxyProof, feePaymentSignature, paymentNonce)

  if (paymentInfo) {
    const params = {
      proxyParams: [proxyProof, externalRef, royalties, t1Authority],
      relayerAddress: relayer,
      paymentInfo
    }
  }

  await sendTx(responseObject, call.id, requestId, 'avnProxy', process.env.MQ_AVN_TX_QUEUE, pallet, method, params)
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

  try {
    if (utils.isValidAccountId(relayer) === false) throw 'relayer'
    if (utils.isValidAccountId(signer) === false) throw 'signer'
    if (utils.isValidNftId(nftId) === false) throw 'nft ID'
    if (utils.isValidAccountId(recipient) === false) throw 'recipient'
    if (utils.isValidNonce(paymentNonce) === false) throw 'payment nonce'
    if (utils.isValidSignatureFormat(proxyTransferFiatNftSignature) === false) throw 'proxy signature format'
    if (utils.isValidSignatureFormat(feePaymentSignature) === false) throw 'fee signature format'
  } catch (param) {
    const errorMsg = 'invalid ' + param
    utils.logError(errorMsg, call.id, call.params)
    responseObject.error = { code: -32602, message: 'Invalid params' }
    return
  }

  const proxyProof = getProxyProof(signer, relayer, proxyTransferFiatNftSignature)

  const relayerFee = await getRelayerFee(responseObject, relayer, signer, transactionType)

  if (!relayerFee) {
    return
  }

  const paymentInfo = getPaymentInfo(responseObject, signer, relayer, relayerFee, proxyProof, feePaymentSignature, paymentNonce)

  if (paymentInfo) {
    const params = {
      proxyParams: [proxyProof, nftId, recipient],
      relayerAddress: relayer,
      paymentInfo
    }
  }

  await sendTx(responseObject, call.id, requestId, 'avnProxy', process.env.MQ_AVN_TX_QUEUE, pallet, method, params)
}

async function processProxyCancelListFiatNft(call, responseObject, requestId) {
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
    const errorMsg = 'invalid ' + param
    utils.logError(errorMsg, call.id, call.params)
    responseObject.error = { code: -32602, message: 'Invalid params' }
    return
  }

  const proxyProof = getProxyProof(signer, relayer, proxyCancelListFiatNftSignature)

  const relayerFee = await getRelayerFee(responseObject, relayer, signer, transactionType)

  if (!relayerFee) {
    return
  }

  const paymentInfo = getPaymentInfo(responseObject, signer, relayer, relayerFee, proxyProof, feePaymentSignature, paymentNonce)

  if (paymentInfo) {
    const params = {
      proxyParams: [proxyProof, nftId],
      relayerAddress: relayer,
      paymentInfo
    }
  }

  await sendTx(responseObject, call.id, requestId, 'avnProxy', process.env.MQ_AVN_TX_QUEUE, pallet, method, params)
}

async function getRelayerFee(responseObject, relayer, user, transactionType) {
  let response
  try {
    response = await utils.axios.post(AVN_CONNECTOR_ENDPOINT + 'relayerFees', { relayer, user, transactionType })
  } catch (err) {
    utils.logError('failed to retrieve relayer fee', call.id, err)
    responseObject.error = { code: -32603, message: 'Internal error' }
    return undefined
  }

  return response.data.toString()
}

function getPaymentInfo(responseObject, signer, relayer, relayerFee, proxyProof, feePaymentSignature, paymentNonce) {
  const paymentIsAuthorised = utils.verifyFeePaymentSignature(
    signer,
    relayer,
    relayerFee,
    proxyProof,
    feePaymentSignature,
    paymentNonce
  )

  if (!paymentIsAuthorised) {
    utils.logError('invalid fee authorisation', call.id, feePaymentSignature)
    responseObject.error = { code: -32602, message: 'Invalid params' }
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
