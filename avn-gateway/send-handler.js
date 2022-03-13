const utils = require('/opt/utils.js');
const MQSender = require('/opt/mqSender.js');

const AVN_CONNECTOR_ENDPOINT = process.env.AVN_CONNECTOR_ENDPOINT;

let mqSender;

exports.handler = async (event, context) => {
  try {
    await connectToMQ();
  } catch (err) {
    return {
      statusCode: 500,
      error: { message: err.message },
      body: JSON.stringify(utils.errorResponse('internal', 'failed to connect to queue', err, event.body, null))
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify(await processRequest(event.body, context.awsRequestId))
  };
};

const connectToMQ = async () => {
  if (!mqSender || !mqSender.amqpConnection || !mqSender.amqpConnected) {
    mqSender = new MQSender(process.env.SECRET_MANAGER_REGION, process.env.MQ_SECRET_ARN, process.env.MQ_BROKER_AMQP_ENDPOINT);
    await mqSender.connectToMessageBroker();
  }
};

async function processRequest(request, requestId) {
  let call;

  try {
    call = JSON.parse(request);
  } catch (err) {
    return utils.errorResponse('parse', 'failed to parse JSON', err, request, null);
  }

  if (call.id === undefined) call.id = null;
  console.info('CALLID_TO_REQUESTID:', call.id + ':' + requestId);

  if (typeof call.method !== 'string') {
    return utils.errorResponse('request', 'method type must be string', call.method, request, call.id);
  } else {
    return await callSwitch(call, request, requestId);
  }
}

async function callSwitch(call, request, requestId) {
  switch (call.method) {
    case 'proxyAvtTransfer':
    case 'proxyTokenTransfer':
      return await processProxyTransfer(call, request, requestId);
    case 'proxyTokenLower':
      return await processProxyLower(call, request, requestId);
    case 'proxyCancelListFiatNft':
      return await processProxyCancelListFiatNft(call, request, requestId);
    case 'proxyListNftOpenForSale':
      return await processProxyListNftOpenForSale(call, request, requestId);
    case 'proxyMintSingleNft':
      return await processProxyMintSingleNft(call, request, requestId);
    case 'proxyTransferFiatNft':
      return await processProxyTransferFiatNft(call, request, requestId);
    case 'proxyStakeAvt':
      return await processProxyStakeAvt(call, request, requestId);
    default:
      return utils.errorResponse('method', 'method not found', call.method, request, call.id);
  }
}

async function processProxyTransfer(call, request, requestId) {
  const pallet = 'tokenManager';
  const method = 'signedTransfer';
  const { signer, recipient, token, amount } = call.params;
  const methodParams = [signer, recipient, token, amount];

  try {
    if (utils.isValidAccountId(signer) === false) throw 'signer';
    if (utils.isValidAccountId(recipient) === false) throw 'recipient';
    if (utils.isValidEthereumAddress(token) === false) throw 'token';
    if (utils.isValidAmount(amount) === false) throw 'amount';
  } catch (param) {
    return utils.errorResponse('params', 'invalid ' + param, param, request, call.id);
  }

  return await processProxyMethod(call, request, requestId, pallet, method, methodParams);
}

async function processProxyLower(call, request, requestId) {
  const pallet = 'tokenManager';
  const method = 'signedLower';
  const { signer, token, amount, t1Recipient } = call.params;
  const methodParams = [signer, token, amount, t1Recipient];

  try {
    if (utils.isValidAccountId(signer) === false) throw 'signer';
    if (utils.isValidEthereumAddress(token) === false) throw 'token';
    if (utils.isValidAmount(amount) === false) throw 'amount';
    if (utils.isValidEthereumAddress(t1Recipient) === false) throw 't1Recipient';
  } catch (param) {
    return utils.errorResponse('params', 'invalid ' + param, param, request, call.id);
  }

  return await processProxyMethod(call, request, requestId, pallet, method, methodParams);
}

async function processProxyCancelListFiatNft(call, request, requestId) {
  const pallet = 'nftManager';
  const method = 'signedCancelListFiatNft';
  const { nftId } = call.params;
  const methodParams = [nftId];

  try {
    if (utils.isValidNftId(nftId) === false) throw 'nft ID';
  } catch (param) {
    return utils.errorResponse('params', 'invalid ' + param, param, request, call.id);
  }

  return await processProxyMethod(call, request, requestId, pallet, method, methodParams);
}

async function processProxyListNftOpenForSale(call, request, requestId) {
  const pallet = 'nftManager';
  const method = 'signedListNftOpenForSale';
  const { nftId, market } = call.params;
  const methodParams = [nftId, market];

  try {
    if (utils.isValidNftId(nftId) === false) throw 'nft ID';
    if (utils.isValidMarket(market) === false) throw 'market';
  } catch (param) {
    return utils.errorResponse('params', 'invalid ' + param, param, request, call.id);
  }

  return await processProxyMethod(call, request, requestId, pallet, method, methodParams);
}

async function processProxyMintSingleNft(call, request, requestId) {
  const pallet = 'nftManager';
  const method = 'signedMintSingleNft';
  const { externalRef, royalties, t1Authority } = call.params;
  const methodParams = [externalRef, royalties, t1Authority];

  try {
    if (utils.isValidString(externalRef) === false) throw 'externalRef';
    if (utils.isValidArray(royalties) === false) throw 'royalties';
    if (utils.isValidEthereumAddress(t1Authority) === false) throw 't1Authority';
  } catch (param) {
    return utils.errorResponse('params', 'invalid ' + param, param, request, call.id);
  }

  return await processProxyMethod(call, request, requestId, pallet, method, methodParams);
}

async function processProxyTransferFiatNft(call, request, requestId) {
  const pallet = 'nftManager';
  const method = 'signedTransferFiatNft';
  const { nftId, recipient } = call.params;
  const methodParams = [nftId, recipient];

  try {
    if (utils.isValidNftId(nftId) === false) throw 'nft ID';
    if (utils.isValidAccountId(recipient) === false) throw 'recipient';
  } catch (param) {
    return utils.errorResponse('params', 'invalid ' + param, param, request, call.id);
  }

  return await processProxyMethod(call, request, requestId, pallet, method, methodParams);
}

async function processProxyMethod(call, request, requestId, pallet, method, methodParams) {
  const { relayer, signer, proxySignature, feePaymentSignature, paymentNonce } = call.params;

  validateMethodParams(call.id, request, relayer, signer, proxySignature, feePaymentSignature, paymentNonce);

  const params = await getProxyParams(call, request, relayer, signer, proxySignature, feePaymentSignature, paymentNonce, methodParams);
  return await sendTx(call, request, requestId, pallet, method, params);
}

async function getRelayerFee(relayer, user, transactionType) {
  try {
    const avnResponse = await utils.axios.post(AVN_CONNECTOR_ENDPOINT + 'relayerFees', { relayer, user, transactionType });
    return avnResponse.data.toString();
  } catch (error) {
    throw error;
  }
}

function getPaymentInfo(signer, relayer, relayerFee, proxyProof, feePaymentSignature, paymentNonce) {
  const verified = utils.verifyFeePaymentSignature(signer, relayer, relayerFee, proxyProof, feePaymentSignature, paymentNonce);

  if (verified === false) {
    return undefined;
  }

  return {
    recipient: relayer,
    amount: relayerFee,
    signature: {
      Sr25519: feePaymentSignature
    }
  };
}

function getProxyProof(signer, relayer, proxySignature) {
  return {
    signer,
    relayer,
    signature: {
      Sr25519: proxySignature
    }
  };
}

async function processProxyStakeAvt(call, request, requestId) {
  const pallet = 'utility';
  const method = 'batchAll';

  const bond = {
    palletName: 'validatorsManager',
    method: 'signedBond',
    params: await getBondParams(call, request)
  };

  const nominate = {
    palletName: 'validatorsManager',
    method: 'signedNominate',
    params: await getNominateParams(call, request)
  }

  return await sendTx(call, request, requestId, pallet, method, [bond, nominate]);
}

function validateMethodParams(callId, request, relayer, signer, proxySignature, feePaymentSignature, paymentNonce) {
  try {
    if (utils.isValidAccountId(relayer) === false) throw 'relayer';
    if (utils.isValidAccountId(signer) === false) throw 'signer';
    if (utils.isValidSignatureFormat(proxySignature) === false) throw 'proxy signature format';
    if (utils.isValidSignatureFormat(feePaymentSignature) === false) throw 'fee signature format';
    if (utils.isValidNonce(paymentNonce) === false) throw 'payment nonce';
  } catch (errParam) {
    return utils.errorResponse('param', 'invalid' + errParam, errParam, request, callId);
  }
}

async function getProxyParams(call, request, relayer, signer, proxySignature, feePaymentSignature, paymentNonce, methodParams) {
  const proxyProof = getProxyProof(signer, relayer, proxySignature);

  let relayerFee;
  try {
    relayerFee = await getRelayerFee(relayer, signer, call.method);
  } catch (error) {
    return utils.errorResponse('internal', 'could not get relayer fee', error, request, call.id);
  }

  const paymentInfo = getPaymentInfo(signer, relayer, relayerFee, proxyProof, feePaymentSignature, paymentNonce);
  if (!paymentInfo) {
    return utils.errorResponse('params', 'invalid fee authorisation', feePaymentSignature, request, call.id);
  }

  return {
    proxyParams: [proxyProof].concat(methodParams),
    relayerAddress: relayer,
    paymentInfo
  };
}

async function getBondParams(call, request) {
  const { relayer, signer, amount, proxyBondSignature, bondFeePaymentSignature, bondPaymentNonce } = call.params;

  const bondMethodParams = [signer, amount, utils.STASH_REWARD_DESTINATION];
  try {
    if (utils.isValidAccountId(signer) === false) throw 'signer';
    if (utils.isValidAmount(amount) === false) throw 'amount';
  } catch (errParam) {
    return utils.errorResponse('params', 'invalid ' + errParam, errParam, request, call.id);
  }

  validateMethodParams(call.id, request, relayer, signer, proxyBondSignature, bondFeePaymentSignature, bondPaymentNonce);

  return await getProxyParams(
    call,
    request,
    relayer,
    signer,
    proxyBondSignature,
    bondFeePaymentSignature,
    bondPaymentNonce,
    bondMethodParams
  );
}

async function getNominateParams(call, request) {
  const { relayer, signer, targets, proxyNominateSignature, nominateFeePaymentSignature, nominatePaymentNonce  } = call.params;
  const nominateMethodParams = [targets];

  try {
    if (utils.isValidArray(targets) === false || targets.length === 0) throw 'targets';
  } catch (errParam) {
    return utils.errorResponse('params', 'invalid ' + errParam, errParam, request, call.id);
  }

  validateMethodParams(call.id, request, relayer, signer, proxyNominateSignature, nominateFeePaymentSignature, nominatePaymentNonce);

  return await getProxyParams(
    call,
    request,
    relayer,
    signer,
    proxyNominateSignature,
    nominateFeePaymentSignature,
    nominatePaymentNonce,
    nominateMethodParams
  );
}

async function sendTx(call, request, requestId, palletName, method, params) {
  try {
    const queue = process.env.MQ_AVN_TX_QUEUE;
    const txType = 'avnProxy';
    const result = await mqSender.sendMessageToMQ(queue, { requestId, txType, palletName, method, params });
    return utils.validResponse(call.id, result);
  } catch (err) {
    return utils.errorResponse('internal', 'failed to send proxy transaction', err, request, call.id);
  }
}
