const utils = require('/opt/utils.js');
const sqs = require('/opt/sqsUtils.js');
const fees = require('/opt/paymentUtils.js');
const MQSender = require('/opt/mqSender.js');

const AVN_CONNECTOR_ENDPOINT = process.env.AVN_CONNECTOR_ENDPOINT;

let mqSender;

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
    const mqChannel = await connectToMQ();

    for (let record of event.Records) {
      const timeoutMs = context.getRemainingTimeInMillis() - utils.ONE_SECOND;
      if (timeoutMs > 0) {
        result = await utils.callWithTimeout(timeoutMs, processRequest, [mqChannel, record.body]);
      } else {
        throw new Error("Lambda execution exceeded allowed time");
      }

      if (utils.requestFailed(result) === true) {
        // Stop on the first failure because this is a FIFO queue
        break;
      }

      processedMessagesCount += 1;
    }

    await mqChannel.close();

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

const connectToMQ = async () => {
  try {
    if (!mqSender || !mqSender.amqpConnection || !mqSender.amqpConnected) {
      mqSender = new MQSender(
        process.env.SECRET_MANAGER_REGION,
        process.env.MQ_SECRET_ARN,
        process.env.MQ_BROKER_AMQP_ENDPOINT
      );
      await mqSender.connectToMessageBroker();
    }
    return await mqSender.openChannel();
  } catch (err) {
    console.error(`Failed to connect to Rabbit MQ: `, err);
    throw err;
  }
};

async function processRequest(mqChannel, request) {
  let call;
  let requestId;

  try {
    call = JSON.parse(request);
    requestId = call.awsRequestId;
  } catch (err) {
    console.error(`Failed to parse message as JSON: `, err);
    throw err;
  }

  if (call.id === undefined) call.id = null;
  console.info('CALLID_TO_REQUESTID:', call.id + ' : ' + requestId);

  if (typeof call.method !== 'string') {
    return utils.buildErrorBody('request', 'method type must be string', call.method, request, call.id);
  } else {
    return await callSwitch(call, mqChannel, request, requestId);
  }
}

async function callSwitch(call, mqChannel, request, requestId) {
  console.info(`Processing call: ${call.method}`);

  switch (call.method) {
    case 'proxyAvtTransfer':
    case 'proxyTokenTransfer':
      return await processProxyTransfer(call, mqChannel, request, requestId);
    case 'proxyConfirmTokenLift':
      return await processProxyAddEthereumLog(call, mqChannel, request, requestId);
    case 'proxyTokenLower':
      return await processProxyTokenLower(call, mqChannel, request, requestId);
    case 'proxyCreateNftBatch':
      return await processProxyCreateNftBatch(call, mqChannel, request, requestId);
    case 'proxyCancelListFiatNft':
      return await processProxyCancelListFiatNft(call, mqChannel, request, requestId);
    case 'proxyEndNftBatchSale':
      return await processProxyEndNftBatchSale(call, mqChannel, request, requestId);
    case 'proxyListNftOpenForSale':
      return await processProxyListNftOpenForSale(call, mqChannel, request, requestId);
    case 'proxyListNftBatchForSale':
      return await processProxyListNftBatchForSale(call, mqChannel, request, requestId);
    case 'proxyMintSingleNft':
      return await processProxyMintSingleNft(call, mqChannel, request, requestId);
    case 'proxyMintBatchNft':
      return await processProxyMintBatchNft(call, mqChannel, request, requestId);
    case 'proxyTransferFiatNft':
      return await processProxyTransferFiatNft(call, mqChannel, request, requestId);
    case 'proxyStakeAvt':
      return await processProxyStakeAvt(call, mqChannel, request, requestId);
    case 'proxyIncreaseStake':
      return await processProxyIncreaseStake(call, mqChannel, request, requestId);
    case 'proxyUnstake':
      return await processProxyUnstake(call, mqChannel, request, requestId);
    case 'proxyWithdrawUnlocked':
      return await processProxyWithdrawUnlocked(call, mqChannel, request, requestId);
    case 'proxyScheduleLeaveNominators':
      return await processProxyScheduleLeaveNominators(call, mqChannel, request, requestId);
    case 'proxyExecuteLeaveNominators':
      return await processProxyExecuteLeaveNominators(call, mqChannel, request, requestId);
    default:
      return utils.buildErrorBody('method', 'method not found', call.method, request, call.id);
  }
}

async function processProxyTransfer(call, mqChannel, request, requestId) {
  const pallet = 'tokenManager';
  const method = 'signedTransfer';
  let { user, recipient, token, amount, relayer, nonce, proxySignature } = call.params;
  const methodParams = [user, recipient, token, amount];

  if (!nonce) nonce = await queryNonce(call.id, utils.NONCE_INFO.token, user);

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

  return await processProxyMethod(call, mqChannel, request, requestId, pallet, method, methodParams);
}

async function processProxyAddEthereumLog(call, mqChannel, request, requestId) {
  const pallet = 'ethereumEvents';
  const method = 'signedAddEthereumLog';
  let { eventType, ethereumTransactionHash, relayer, nonce, proxySignature, user } = call.params;
  const methodParams = [eventType, ethereumTransactionHash];

  if (!nonce) nonce = await queryNonce(call.id, utils.NONCE_INFO.confirmation, user);

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

  return await processProxyMethod(call, mqChannel, request, requestId, pallet, method, methodParams);
}

async function processProxyTokenLower(call, mqChannel, request, requestId) {
  const pallet = 'tokenManager';
  const method = 'signedLower';
  let { user, token, amount, t1Recipient, relayer, nonce, proxySignature } = call.params;
  const methodParams = [user, token, amount, t1Recipient];

  if (!nonce) nonce = await queryNonce(call.id, utils.NONCE_INFO.token, user);

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

  return await processProxyMethod(call, mqChannel, request, requestId, pallet, method, methodParams);
}

async function processProxyCreateNftBatch(call, mqChannel, request, requestId) {
  const pallet = 'nftManager';
  const method = 'signedCreateBatch';
  let { totalSupply, royalties, t1Authority, relayer, nonce, proxySignature, user } = call.params;
  const methodParams = [totalSupply, royalties, t1Authority];

  if (!nonce) nonce = await queryNonce(call.id, utils.NONCE_INFO.batch, user);

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

  return await processProxyMethod(call, mqChannel, request, requestId, pallet, method, methodParams);
}

async function processProxyCancelListFiatNft(call, mqChannel, request, requestId) {
  const pallet = 'nftManager';
  const method = 'signedCancelListFiatNft';
  let { nftId, relayer, nonce, proxySignature, user } = call.params;
  const methodParams = [nftId];

  if (!nonce) nonce = await queryNonce(call.id, utils.NONCE_INFO.nft, nftId);

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

  return await processProxyMethod(call, mqChannel, request, requestId, pallet, method, methodParams);
}

async function processProxyEndNftBatchSale(call, mqChannel, request, requestId) {
  const pallet = 'nftManager';
  const method = 'signedEndBatchSale';
  let { batchId, relayer, nonce, proxySignature, user } = call.params;
  const methodParams = [batchId];

  if (!nonce) nonce = await queryNonce(call.id, utils.NONCE_INFO.batch, user);

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

  return await processProxyMethod(call, mqChannel, request, requestId, pallet, method, methodParams);
}

async function processProxyListNftOpenForSale(call, mqChannel, request, requestId) {
  const pallet = 'nftManager';
  const method = 'signedListNftOpenForSale';
  let { nftId, market, relayer, nonce, proxySignature, user } = call.params;
  const methodParams = [nftId, market];

  if (!nonce) nonce = await queryNonce(call.id, utils.NONCE_INFO.nft, nftId);

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

  return await processProxyMethod(call, mqChannel, request, requestId, pallet, method, methodParams);
}

async function processProxyListNftBatchForSale(call, mqChannel, request, requestId) {
  const pallet = 'nftManager';
  const method = 'signedListBatchForSale';
  let { batchId, market, relayer, nonce, proxySignature, user } = call.params;
  const methodParams = [batchId, market];

  if (!nonce) nonce = await queryNonce(call.id, utils.NONCE_INFO.batch, user);

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

  return await processProxyMethod(call, mqChannel, request, requestId, pallet, method, methodParams);
}

async function processProxyMintSingleNft(call, mqChannel, request, requestId) {
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

  return await processProxyMethod(call, mqChannel, request, requestId, pallet, method, methodParams);
}

async function processProxyMintBatchNft(call, mqChannel, request, requestId) {
  const pallet = 'nftManager';
  const method = 'signedMintBatchNft';
  const { batchId, index, owner, externalRef, relayer, proxySignature, user } = call.params;
  const methodParams = [batchId, index, owner, externalRef];

  const signData = [
    { Text: 'authorization for mint batch nft operation' },
    { AccountId: relayer },
    { U256: batchId },
    { u64: index },
    { AccountId: owner },
    { 'Vec<u8>': externalRef }
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

  return await processProxyMethod(call, mqChannel, request, requestId, pallet, method, methodParams);
}

async function processProxyTransferFiatNft(call, mqChannel, request, requestId) {
  const pallet = 'nftManager';
  const method = 'signedTransferFiatNft';
  let { nftId, recipient, relayer, nonce, proxySignature, user } = call.params;
  const methodParams = [nftId, recipient];

  if (!nonce) nonce = await queryNonce(call.id, utils.NONCE_INFO.nft, nftId);

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

  return await processProxyMethod(call, mqChannel, request, requestId, pallet, method, methodParams);
}

async function processProxyStakeAvt(call, mqChannel, request, requestId) {
  const pallet = 'parachainStaking';
  const method = 'signedNominate';
  let { targets, amount, relayer, nonce, proxySignature, user } = call.params;
  const methodParams = [targets, amount];

  if (!nonce) nonce = await queryNonce(call.id, utils.NONCE_INFO.staking, user);

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

  return await processProxyMethod(call, mqChannel, request, requestId, pallet, method, methodParams);
}

async function processProxyIncreaseStake(call, mqChannel, request, requestId) {
  const pallet = 'parachainStaking';
  const method = 'signedBondExtra';
  let { amount, relayer, nonce, proxySignature, user } = call.params;
  const methodParams = [amount];

  if (!nonce) nonce = await queryNonce(call.id, utils.NONCE_INFO.staking, user);

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

  return await processProxyMethod(call, mqChannel, request, requestId, pallet, method, methodParams);
}

async function processProxyUnstake(call, mqChannel, request, requestId) {
  const pallet = 'parachainStaking';
  const method = 'signedScheduleNominatorUnbond';
  let { amount, relayer, nonce, proxySignature, user } = call.params;
  const methodParams = [amount];

  if (!nonce) nonce = await queryNonce(call.id, utils.NONCE_INFO.staking, user);

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

  return await processProxyMethod(call, mqChannel, request, requestId, pallet, method, methodParams);
}

async function processProxyWithdrawUnlocked(call, mqChannel, request, requestId) {
  const pallet = 'parachainStaking';
  const method = 'signedExecuteNominationRequest';
  let { relayer, nonce, proxySignature, user } = call.params;
  const methodParams = [user];

  if (!nonce) nonce = await queryNonce(call.id, utils.NONCE_INFO.staking, user);

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

  return await processProxyMethod(call, mqChannel, request, requestId, pallet, method, methodParams);
}

async function processProxyScheduleLeaveNominators(call, mqChannel, request, requestId) {
  const pallet = 'parachainStaking';
  const method = 'signedScheduleLeaveNominators';
  let { relayer, nonce, proxySignature, user } = call.params;
  const methodParams = [];

  if (!nonce) nonce = await queryNonce(call.id, utils.NONCE_INFO.staking, user);

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

  return await processProxyMethod(call, mqChannel, request, requestId, pallet, method, methodParams);
}

async function processProxyExecuteLeaveNominators(call, mqChannel, request, requestId) {
  const pallet = 'parachainStaking';
  const method = 'signedExecuteLeaveNominators';
  let { relayer, nonce, proxySignature, user } = call.params;
  const methodParams = [user];

  if (!nonce) nonce = await queryNonce(call.id, utils.NONCE_INFO.staking, user);

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

  return await processProxyMethod(call, mqChannel, request, requestId, pallet, method, methodParams);
}

async function queryNonce(callId, nonceInfo, nonceKey) {
  const { palletName, storageName } = nonceInfo;
  const params = { callId, palletName, storageName, params: [nonceKey] };
  const result = await utils.axios.post(AVN_CONNECTOR_ENDPOINT + 'avnQuery', params);
  return storageName === 'nfts' ? utils.toBnString(result.data.nonce) : utils.toBnString(result.data);
}

async function processProxyMethod(call, mqChannel, request, requestId, pallet, method, methodParams) {
  const { relayer, user, payer, proxySignature, feePaymentSignature, paymentNonce } = call.params;

  try {
    if (utils.isValidAccountId(relayer) === false) throw 'relayer';
    if (utils.isValidAccountId(user) === false) throw 'user';
    if (utils.isValidAccountId(payer) === false) throw 'payer';
    if (utils.isValidSignatureFormat(proxySignature) === false) throw 'proxySignature';
    if (utils.isValidSignatureFormat(feePaymentSignature) === false) throw 'feePaymentSignature';
    if (utils.isValidNonce(paymentNonce) === false) throw 'paymentNonce';
  } catch (param) {
    return utils.buildErrorBody('params', `invalid proxy method ${param}: ${call.params[param]}`, param, request, call.id);
  }

  const proxyProof = utils.getProxyProof(user, relayer, proxySignature);
  const paymentInfo = await fees.tryGetPaymentInfo(
    AVN_CONNECTOR_ENDPOINT,
    payer,
    relayer,
    feePaymentSignature,
    call.method,
    paymentNonce,
    proxyProof
  );

  const params = {
    proxyParams: [proxyProof].concat(methodParams),
    relayerAddress: relayer,
    paymentInfo
  };

  return await sendTx(call, mqChannel, request, requestId, pallet, method, params);
}

async function sendTx(call, mqChannel, request, requestId, palletName, method, params) {
  try {
    const queue = process.env.MQ_AVN_TX_QUEUE;
    const txType = 'avnProxy';
    const result = await mqSender.sendMessageToMQ(queue, mqChannel, { requestId, txType, palletName, method, params });
    return utils.buildValidResponseBody(call.id, result);
  } catch (err) {
    return utils.buildErrorBody('internal', 'failed to send proxy transaction', err.toString(), request, call.id);
  }
}