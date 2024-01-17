const utils = require('/opt/utils.js');
const sqs = require('/opt/sqsUtils.js');
const fees = require('/opt/paymentUtils.js');
const SQSSender = require('/opt/sqsSender.js');
const sqsSender = new SQSSender(process.env.SECRET_MANAGER_REGION, process.env.SQS_SECRET_ARN, process.env.SQS_AVN_TX_QUEUE);
const AVN_CONNECTOR_ENDPOINT = process.env.AVN_CONNECTOR_ENDPOINT;

exports.handler = async (event, context) => {
  let processedMessagesCount = 0;

  try {
    if (!event.Records) {
      console.log(`No messages to process.`);
      return {
        statusCode: 200,
        body: `No messages to process`
      };
    }

    console.log(`Processing ${event.Records.length} message(s) from queue`);

    for (let record of event.Records) {
      let result;
      const timeoutMs = context.getRemainingTimeInMillis() - utils.ONE_SECOND;
      if (timeoutMs > 0) {
        result = await utils.callWithTimeout(timeoutMs, processRequest, [record.body]);
      } else {
        throw new Error('Lambda execution exceeded allowed time');
      }

      if (utils.requestFailed(result) === true) {
        // Stop on the first failure because this is a FIFO queue
        break;
      }

      processedMessagesCount += 1;
    }

    if (processedMessagesCount < event.Records.length) {
      console.warn(`Processed ${processedMessagesCount} out of ${event.Records.length} message(s) successfully.`);
      return {
        batchItemFailures: sqs.getFailedMessagesForFifoQueue(event.Records, processedMessagesCount)
      };
    }

    return {
      statusCode: 200,
      body: `${event.Records.length} message(s) processed successfully.`
    };
  } catch (err) {
    console.error(`Failed to process messages from default queue: `, err);

    return {
      batchItemFailures: sqs.getFailedMessagesForFifoQueue(event.Records, processedMessagesCount)
    };
  }
};

async function processRequest(request) {
  let call;
  let requestId;

  try {
    call = JSON.parse(request);
    requestId = call.awsRequestId;
  } catch (err) {
    console.error(`Failed to parse message as JSON: `, err);
    return utils.buildErrorBody('parse', 'Failed to parse message as JSON', err.toString(), request, null);
  }

  try {
    if (call.id === undefined) call.id = null;
    console.info('CALLID_TO_REQUESTID:', call.id + ' : ' + requestId);

    if (typeof call.method !== 'string') {
      return utils.buildErrorBody('request', 'method type must be string', call.method, request, call.id);
    } else {
      return await callSwitch(call, request, requestId);
    }
  } catch (err) {
    console.error(`Failed to process message from default queue: `, err);
    return utils.buildErrorBody('request', 'Failed to process message from default queue', err.toString(), request, call.id);
  }
}

async function callSwitch(call, request, requestId) {
  console.info(`${requestId} - Processing call: ${call.method}, proxy nonce: ${(call.params || {}).nonce}`);

  switch (call.method) {
    case 'proxyAvtTransfer':
    case 'proxyTokenTransfer':
      return await processProxyTransfer(call, request, requestId);
    case 'proxyConfirmTokenLift':
      return await processProxyAddEthereumLog(call, request, requestId);
    case 'proxyTokenLower':
      return await processProxyTokenLower(call, request, requestId);
    case 'proxyCreateNftBatch':
      return await processProxyCreateNftBatch(call, request, requestId);
    case 'proxyCancelListFiatNft':
      return await processProxyCancelListFiatNft(call, request, requestId);
    case 'proxyEndNftBatchSale':
      return await processProxyEndNftBatchSale(call, request, requestId);
    case 'proxyListNftOpenForSale':
      return await processProxyListNftOpenForSale(call, request, requestId);
    case 'proxyListNftBatchForSale':
      return await processProxyListNftBatchForSale(call, request, requestId);
    case 'proxyMintSingleNft':
      return await processProxyMintSingleNft(call, request, requestId);
    case 'proxyMintBatchNft':
      return await processProxyMintBatchNft(call, request, requestId);
    case 'proxyTransferFiatNft':
      return await processProxyTransferFiatNft(call, request, requestId);
    case 'proxyStakeAvt':
      return await processProxyStakeAvt(call, request, requestId);
    case 'proxyIncreaseStake':
      return await processProxyIncreaseStake(call, request, requestId);
    case 'proxyUnstake':
      return await processProxyUnstake(call, request, requestId);
    case 'proxyWithdrawUnlocked':
      return await processProxyWithdrawUnlocked(call, request, requestId);
    case 'proxyScheduleLeaveNominators':
      return await processProxyScheduleLeaveNominators(call, request, requestId);
    case 'proxyExecuteLeaveNominators':
      return await processProxyExecuteLeaveNominators(call, request, requestId);
    default:
      return utils.buildErrorBody('method', 'method not found', call.method, request, call.id);
  }
}

async function processProxyTransfer(call, request, requestId) {
  const pallet = 'tokenManager';
  const method = 'signedTransfer';
  let { user, recipient, token, amount, relayer, nonce, proxySignature } = call.params;
  const methodParams = [user, recipient, token, amount];

  if (!nonce) nonce = await queryNonce(requestId, utils.NONCE_INFO.token, user);

  const signData = [
    { Text: 'authorization for transfer operation' },
    { AccountId: relayer },
    { AccountId: user },
    { AccountId: recipient },
    { H160: token },
    { u128: amount },
    { u64: nonce }
  ];

  try {
    if (utils.isValidAccountId(user) === false) throw 'user';
    if (utils.isValidAccountId(recipient) === false) throw 'recipient';
    if (utils.isValidEthereumAddress(token) === false) throw 'token';
    if (utils.isValidAmount(amount) === false) throw 'amount';
    if (utils.isValidProxySignature(proxySignature, user, signData) === false) throw 'proxySignature';
  } catch (param) {
    return utils.buildErrorBody('params', `invalid ${param}: ${call.params[param]}`, param, request, call.id);
  }

  return await processProxyMethod(call, request, requestId, pallet, method, methodParams);
}

async function processProxyAddEthereumLog(call, request, requestId) {
  const pallet = 'ethereumEvents';
  const method = 'signedAddEthereumLog';
  let { eventType, ethereumTransactionHash, relayer, nonce, proxySignature, user } = call.params;
  const methodParams = [eventType, ethereumTransactionHash];

  if (!nonce) nonce = await queryNonce(requestId, utils.NONCE_INFO.confirmation, user);

  const signData = [
    { Text: 'authorization for add ethereum log operation' },
    { AccountId: relayer },
    { u8: eventType },
    { H256: ethereumTransactionHash },
    { u64: nonce }
  ];

  try {
    if (utils.isValidEventType(eventType) === false) throw 'eventType';
    if (utils.isValidEthereumTransactionHash(ethereumTransactionHash) === false) throw 'ethereumTransactionHash';
    if (utils.isValidProxySignature(proxySignature, user, signData) === false) throw 'proxySignature';
  } catch (param) {
    return utils.buildErrorBody('params', `invalid ${param}: ${call.params[param]}`, param, request, call.id);
  }

  return await processProxyMethod(call, request, requestId, pallet, method, methodParams);
}

async function processProxyTokenLower(call, request, requestId) {
  const pallet = 'tokenManager';
  const method = 'scheduleSignedLower';
  let { user, token, amount, t1Recipient, relayer, nonce, proxySignature } = call.params;
  const methodParams = [user, token, amount, t1Recipient];

  if (!nonce) nonce = await queryNonce(requestId, utils.NONCE_INFO.token, user);

  const signData = [
    { Text: 'authorization for lower operation' },
    { AccountId: relayer },
    { AccountId: user },
    { H160: token },
    { u128: amount },
    { H160: t1Recipient },
    { u64: nonce }
  ];

  try {
    if (utils.isValidAccountId(user) === false) throw 'user';
    if (utils.isValidEthereumAddress(token) === false) throw 'token';
    if (utils.isValidAmount(amount) === false) throw 'amount';
    if (utils.isValidEthereumAddress(t1Recipient) === false) throw 't1Recipient';
    if (utils.isValidProxySignature(proxySignature, user, signData) === false) throw 'proxySignature';
  } catch (param) {
    return utils.buildErrorBody('params', `invalid ${param}: ${call.params[param]}`, param, request, call.id);
  }

  return await processProxyMethod(call, request, requestId, pallet, method, methodParams);
}

async function processProxyCreateNftBatch(call, request, requestId) {
  const pallet = 'nftManager';
  const method = 'signedCreateBatch';
  let { totalSupply, royalties, t1Authority, relayer, nonce, proxySignature, user } = call.params;
  const methodParams = [totalSupply, royalties, t1Authority];

  if (!nonce) nonce = await queryNonce(requestId, utils.NONCE_INFO.batch, user);

  const signData = [
    { Text: 'authorization for create batch operation' },
    { AccountId: relayer },
    { u64: totalSupply },
    { SkipEncode: utils.encodeRoyalties(royalties) },
    { H160: t1Authority },
    { u64: nonce }
  ];

  try {
    if (utils.isValidNumber(totalSupply) === false) throw 'totalSupply';
    if (utils.isValidArray(royalties) === false) throw 'royalties';
    if (utils.isValidEthereumAddress(t1Authority) === false) throw 't1Authority';
    if (utils.isValidProxySignature(proxySignature, user, signData) === false) throw 'proxySignature';
  } catch (param) {
    return utils.buildErrorBody('params', `invalid ${param}: ${call.params[param]}`, param, request, call.id);
  }

  return await processProxyMethod(call, request, requestId, pallet, method, methodParams);
}

async function processProxyCancelListFiatNft(call, request, requestId) {
  const pallet = 'nftManager';
  const method = 'signedCancelListFiatNft';
  let { nftId, relayer, nonce, proxySignature, user } = call.params;
  const methodParams = [nftId];

  if (!nonce) nonce = await queryNonce(requestId, utils.NONCE_INFO.nft, nftId);

  const signData = [
    { Text: 'authorization for cancel list fiat nft for sale operation' },
    { AccountId: relayer },
    { U256: nftId },
    { u64: nonce }
  ];

  try {
    if (utils.isValidNftId(nftId) === false) throw 'nftId';
    if (utils.isValidProxySignature(proxySignature, user, signData) === false) throw 'proxySignature';
  } catch (param) {
    return utils.buildErrorBody('params', `invalid ${param}: ${call.params[param]}`, param, request, call.id);
  }

  return await processProxyMethod(call, request, requestId, pallet, method, methodParams);
}

async function processProxyEndNftBatchSale(call, request, requestId) {
  const pallet = 'nftManager';
  const method = 'signedEndBatchSale';
  let { batchId, relayer, nonce, proxySignature, user } = call.params;
  const methodParams = [batchId];

  if (!nonce) nonce = await queryNonce(requestId, utils.NONCE_INFO.batch, user);

  const signData = [
    { Text: 'authorization for end batch sale operation' },
    { AccountId: relayer },
    { U256: batchId },
    { u64: nonce }
  ];

  try {
    if (utils.isValidNftId(batchId) === false) throw 'batchId';
    if (utils.isValidProxySignature(proxySignature, user, signData) === false) throw 'proxySignature';
  } catch (param) {
    return utils.buildErrorBody('params', `invalid ${param}: ${call.params[param]}`, param, request, call.id);
  }

  return await processProxyMethod(call, request, requestId, pallet, method, methodParams);
}

async function processProxyListNftOpenForSale(call, request, requestId) {
  const pallet = 'nftManager';
  const method = 'signedListNftOpenForSale';
  let { nftId, market, relayer, nonce, proxySignature, user } = call.params;
  const methodParams = [nftId, market];

  if (!nonce) nonce = await queryNonce(requestId, utils.NONCE_INFO.nft, nftId);

  const signData = [
    { Text: 'authorization for list nft open for sale operation' },
    { AccountId: relayer },
    { U256: nftId },
    { u8: market },
    { u64: nonce }
  ];

  try {
    if (utils.isValidNftId(nftId) === false) throw 'nftId';
    if (utils.isValidMarket(market) === false) throw 'market';
    if (utils.isValidProxySignature(proxySignature, user, signData) === false) throw 'proxySignature';
  } catch (param) {
    return utils.buildErrorBody('params', `invalid ${param}: ${call.params[param]}`, param, request, call.id);
  }

  return await processProxyMethod(call, request, requestId, pallet, method, methodParams);
}

async function processProxyListNftBatchForSale(call, request, requestId) {
  const pallet = 'nftManager';
  const method = 'signedListBatchForSale';
  let { batchId, market, relayer, nonce, proxySignature, user } = call.params;
  const methodParams = [batchId, market];

  if (!nonce) nonce = await queryNonce(requestId, utils.NONCE_INFO.batch, user);

  const signData = [
    { Text: 'authorization for list batch for sale operation' },
    { AccountId: relayer },
    { U256: batchId },
    { u8: market },
    { u64: nonce }
  ];

  try {
    if (utils.isValidNftId(batchId) === false) throw 'batchId';
    if (utils.isValidMarket(market) === false) throw 'market';
    if (utils.isValidProxySignature(proxySignature, user, signData) === false) throw 'proxySignature';
  } catch (param) {
    return utils.buildErrorBody('params', `invalid ${param}: ${call.params[param]}`, param, request, call.id);
  }

  return await processProxyMethod(call, request, requestId, pallet, method, methodParams);
}

async function processProxyMintSingleNft(call, request, requestId) {
  const pallet = 'nftManager';
  const method = 'signedMintSingleNft';
  const { externalRef, royalties, t1Authority, relayer, proxySignature, user } = call.params;
  const methodParams = [externalRef, royalties, t1Authority];

  const signData = [
    { Text: 'authorization for mint single nft operation' },
    { AccountId: relayer },
    { 'Vec<u8>': externalRef },
    { SkipEncode: utils.encodeRoyalties(royalties) },
    { H160: t1Authority }
  ];

  try {
    if (utils.isValidString(externalRef) === false) throw 'externalRef';
    if (utils.isValidArray(royalties) === false) throw 'royalties';
    if (utils.isValidEthereumAddress(t1Authority) === false) throw 't1Authority';
    if (utils.isValidProxySignature(proxySignature, user, signData) === false) throw 'proxySignature';
  } catch (param) {
    return utils.buildErrorBody('params', `invalid ${param}: ${call.params[param]}`, param, request, call.id);
  }

  return await processProxyMethod(call, request, requestId, pallet, method, methodParams);
}

async function processProxyMintBatchNft(call, request, requestId) {
  const pallet = 'nftManager';
  const method = 'signedMintBatchNft';
  const { batchId, index, owner, externalRef, relayer, proxySignature, user } = call.params;
  const methodParams = [batchId, index, owner, externalRef];

  const signData = [
    { Text: 'authorization for mint batch nft operation' },
    { AccountId: relayer },
    { U256: batchId },
    { u64: index },
    { 'Vec<u8>': externalRef },
    { AccountId: owner }
  ];

  try {
    if (utils.isValidNftId(batchId) === false) throw 'batchId';
    if (utils.isValidNumber(index) === false) throw 'index';
    if (utils.isValidAccountId(owner) === false) throw 'owner';
    if (utils.isValidString(externalRef) === false) throw 'externalRef';
    if (utils.isValidProxySignature(proxySignature, user, signData) === false) throw 'proxySignature';
  } catch (param) {
    return utils.buildErrorBody('params', `invalid ${param}: ${call.params[param]}`, param, request, call.id);
  }

  return await processProxyMethod(call, request, requestId, pallet, method, methodParams);
}

async function processProxyTransferFiatNft(call, request, requestId) {
  const pallet = 'nftManager';
  const method = 'signedTransferFiatNft';
  let { nftId, recipient, relayer, nonce, proxySignature, user } = call.params;
  const methodParams = [nftId, recipient];

  if (!nonce) nonce = await queryNonce(requestId, utils.NONCE_INFO.nft, nftId);

  const signData = [
    { Text: 'authorization for transfer fiat nft operation' },
    { AccountId: relayer },
    { U256: nftId },
    { AccountId: recipient },
    { u64: nonce }
  ];

  try {
    if (utils.isValidNftId(nftId) === false) throw 'nftId';
    if (utils.isValidAccountId(recipient) === false) throw 'recipient';
    if (utils.isValidProxySignature(proxySignature, user, signData) === false) throw 'proxySignature';
  } catch (param) {
    return utils.buildErrorBody('params', `invalid ${param}: ${call.params[param]}`, param, request, call.id);
  }

  return await processProxyMethod(call, request, requestId, pallet, method, methodParams);
}

async function processProxyStakeAvt(call, request, requestId) {
  const pallet = 'parachainStaking';
  const method = 'signedNominate';
  let { targets, amount, relayer, nonce, proxySignature, user } = call.params;
  const methodParams = [targets, amount];

  if (!nonce) nonce = await queryNonce(requestId, utils.NONCE_INFO.staking, user);

  const signData = [
    { Text: 'parachain authorization for nominate operation' },
    { AccountId: utils.convertToPublicKey(relayer) },
    { 'Vec<LookupSource>': targets },
    { BalanceOf: amount },
    { u64: nonce }
  ];

  try {
    if (utils.isValidArray(targets) === false || targets.length === 0) throw 'targets';
    if (utils.isValidAmount(amount) === false) throw 'amount';
    if (utils.isValidProxySignature(proxySignature, user, signData) === false) throw 'proxySignature';
  } catch (param) {
    // TODO: Include the bad param value in the error logs when returning errors. This applies to all `utils.buildErrorBody()`
    return utils.buildErrorBody('params', `invalid ${param}: ${call.params[param]}`, param, request, call.id);
  }

  return await processProxyMethod(call, request, requestId, pallet, method, methodParams);
}

async function processProxyIncreaseStake(call, request, requestId) {
  const pallet = 'parachainStaking';
  const method = 'signedBondExtra';
  let { amount, relayer, nonce, proxySignature, user } = call.params;
  const methodParams = [amount];

  if (!nonce) nonce = await queryNonce(requestId, utils.NONCE_INFO.staking, user);

  const signData = [
    { Text: 'parachain authorization for nominator bond extra operation' },
    { AccountId: relayer },
    { BalanceOf: amount },
    { u64: nonce }
  ];

  try {
    if (utils.isValidAmount(amount) === false) throw 'amount';
    if (utils.isValidProxySignature(proxySignature, user, signData) === false) throw 'proxySignature';
  } catch (param) {
    return utils.buildErrorBody('params', `invalid ${param}: ${call.params[param]}`, param, request, call.id);
  }

  return await processProxyMethod(call, request, requestId, pallet, method, methodParams);
}

async function processProxyUnstake(call, request, requestId) {
  const pallet = 'parachainStaking';
  const method = 'signedScheduleNominatorUnbond';
  let { amount, relayer, nonce, proxySignature, user } = call.params;
  const methodParams = [amount];

  if (!nonce) nonce = await queryNonce(requestId, utils.NONCE_INFO.staking, user);

  const signData = [
    { Text: 'parachain authorization for scheduling nominator unbond operation' },
    { AccountId: relayer },
    { BalanceOf: amount },
    { u64: nonce }
  ];

  try {
    if (utils.isValidAmount(amount) === false) throw 'amount';
    if (utils.isValidProxySignature(proxySignature, user, signData) === false) throw 'proxySignature';
  } catch (param) {
    return utils.buildErrorBody('params', `invalid ${param}: ${call.params[param]}`, param, request, call.id);
  }

  return await processProxyMethod(call, request, requestId, pallet, method, methodParams);
}

async function processProxyWithdrawUnlocked(call, request, requestId) {
  const pallet = 'parachainStaking';
  const method = 'signedExecuteNominationRequest';
  let { relayer, nonce, proxySignature, user } = call.params;
  const methodParams = [user];

  if (!nonce) nonce = await queryNonce(requestId, utils.NONCE_INFO.staking, user);

  const signData = [
    { Text: 'parachain authorization for executing nomination requests operation' },
    { AccountId: relayer },
    { AccountId: user },
    { u64: nonce }
  ];

  try {
    if (utils.isValidAccountId(user) === false) throw 'user';
    if (utils.isValidProxySignature(proxySignature, user, signData) === false) throw 'proxySignature';
  } catch (param) {
    return utils.buildErrorBody('params', `invalid ${param}: ${call.params[param]}`, param, request, call.id);
  }

  return await processProxyMethod(call, request, requestId, pallet, method, methodParams);
}

async function processProxyScheduleLeaveNominators(call, request, requestId) {
  const pallet = 'parachainStaking';
  const method = 'signedScheduleLeaveNominators';
  let { relayer, nonce, proxySignature, user } = call.params;
  const methodParams = [];

  if (!nonce) nonce = await queryNonce(requestId, utils.NONCE_INFO.staking, user);

  const signData = [
    { Text: 'parachain authorization for scheduling leaving nominators operation' },
    { AccountId: relayer },
    { u64: nonce }
  ];

  try {
    if (utils.isValidProxySignature(proxySignature, user, signData) === false) throw 'proxySignature';
  } catch (param) {
    return utils.buildErrorBody('params', `invalid ${param}: ${call.params[param]}`, param, request, call.id);
  }

  return await processProxyMethod(call, request, requestId, pallet, method, methodParams);
}

async function processProxyExecuteLeaveNominators(call, request, requestId) {
  const pallet = 'parachainStaking';
  const method = 'signedExecuteLeaveNominators';
  let { relayer, nonce, proxySignature, user } = call.params;
  const methodParams = [user];

  if (!nonce) nonce = await queryNonce(requestId, utils.NONCE_INFO.staking, user);

  const signData = [
    { Text: 'parachain authorization for executing leave nominators operation' },
    { AccountId: relayer },
    { AccountId: user },
    { u64: nonce }
  ];

  try {
    if (utils.isValidAccountId(user) === false) throw 'user';
    if (utils.isValidProxySignature(proxySignature, user, signData) === false) throw 'proxySignature';
  } catch (param) {
    return utils.buildErrorBody('params', `invalid ${param}: ${call.params[param]}`, param, request, call.id);
  }

  return await processProxyMethod(call, request, requestId, pallet, method, methodParams);
}

//TODO: Fix me. We should not read the nonce from the chain because we risk getting duplicate values for different tx's
async function queryNonce(requestId, nonceInfo, nonceKey) {
  const { palletName, storageName } = nonceInfo;
  console.log(`${requestId} - Refreshing nonce from chain for ${palletName}.${storageName} - ${nonceKey}`);
  const params = { requestId, palletName, storageName, params: [nonceKey] };
  const result = await utils.axios.post(AVN_CONNECTOR_ENDPOINT + 'avnQuery', params);
  const nonce = storageName === 'nfts' ? utils.toBnString(result.data.nonce) : utils.toBnString(result.data);
  console.log(`${requestId} - new nonce: ${nonce}`);
  return nonce;
}

async function processProxyMethod(call, request, requestId, pallet, method, methodParams) {
  const { relayer, user, payer, proxySignature } = call.params;

  try {
    if (utils.isValidAccountId(relayer) === false) throw 'relayer';
    if (utils.isValidAccountId(user) === false) throw 'user';
    if (utils.isValidAccountId(payer) === false) throw 'payer';
    if (utils.isValidSignatureFormat(proxySignature) === false) throw 'proxySignature';

    if (!utils.isSplitFeeTransaction(call)) {
      if (utils.isValidSignatureFormat(call.params.feePaymentSignature) === false) throw 'feePaymentSignature';
      if (utils.isValidNonce(call.params.paymentNonce) === false) throw 'paymentNonce';
    }
  } catch (param) {
    return utils.buildErrorBody('params', `invalid proxy method ${param}: ${call.params[param]}`, param, request, call.id);
  }

  const proxyProof = utils.getProxyProof(user, relayer, proxySignature);

  const params = {
    proxyParams: [proxyProof].concat(methodParams),
    relayerAddress: relayer
  };

  // Split fee transactions will get a payment signature in the connector, before sending to the chain.
  if (utils.isSplitFeeTransaction(call) === true) {
    params.splitFeePayerAddress = call.splitFeePayerAddress;
    params.splitFeePayerVaultId = call.splitFeePayerVaultId;
    params.relayerFees = call.relayerFee;
    params.splitFeeProxyProof = proxyProof;
  } else {
    const paymentInfo = await fees.tryGetPaymentInfo(
      AVN_CONNECTOR_ENDPOINT,
      payer,
      relayer,
      call.params.feePaymentSignature,
      call.method,
      call.params.paymentNonce,
      proxyProof
    );

    params.paymentInfo = paymentInfo;
  }

  return await sendTx(call, request, requestId, pallet, method, params);
}

async function sendTx(call, request, requestId, palletName, method, params) {
  try {
    const txType = 'avnProxy';
    const result = await sqsSender.sendMessageToSQS({ requestId, txType, palletName, method, params });
    return utils.buildValidResponseBody(call.id, result);
  } catch (err) {
    return utils.buildErrorBody('internal', 'failed to send proxy transaction', err.toString(), request, call.id);
  }
}
