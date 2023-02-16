const utils = require('/opt/utils.js');
const sqs = require('/opt/sqsUtils.js');
const fees = require('/opt/paymentUtils.js');
const MQSender = require('/opt/mqSender.js');

const AVN_CONNECTOR_ENDPOINT = process.env.AVN_CONNECTOR_ENDPOINT;

let mqSender;

exports.handler = async (event) => {
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
    await connectToMQ();

    for (let record of event.Records) {
      const result = await processRequest(record.body);

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

const connectToMQ = async () => {
  try {
    if (!mqSender || !mqSender.amqpConnection || !mqSender.amqpConnected) {
      mqSender = new MQSender(process.env.SECRET_MANAGER_REGION, process.env.MQ_SECRET_ARN, process.env.MQ_BROKER_AMQP_ENDPOINT);
      await mqSender.connectToMessageBroker();
    }
  } catch (err) {
    console.error(`Failed to connect to Rabbit MQ: `, err);
    throw err;
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
    throw err;
  }

  if (call.id === undefined) call.id = null;
  console.info('CALLID_TO_REQUESTID:', call.id + ' : ' + requestId);

  if (typeof call.method !== 'string') {
    return utils.buildErrorBody('request', 'method type must be string', call.method, request, call.id);
  } else {
    return await callSwitch(call, request, requestId);
  }
}

async function callSwitch(call, request, requestId) {
  console.info(`Processing call: ${call.method}`);

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
    default:
      return utils.buildErrorBody('method', 'method not found', call.method, request, call.id);
  }
}

async function processProxyTransfer(call, request, requestId) {
  const pallet = 'tokenManager';
  const method = 'signedTransfer';
  const { user, recipient, token, amount } = call.params;
  const methodParams = [user, recipient, token, amount];

  try {
    if (utils.isValidAccountId(user) === false) throw 'user';
    if (utils.isValidAccountId(recipient) === false) throw 'recipient';
    if (utils.isValidEthereumAddress(token) === false) throw 'token';
    if (utils.isValidAmount(amount) === false) throw 'amount';
  } catch (param) {
    return utils.buildErrorBody('params', 'invalid ' + param, param, request, call.id);
  }

  return await processProxyMethod(call, request, requestId, pallet, method, methodParams);
}

async function processProxyAddEthereumLog(call, request, requestId) {
  const pallet = 'ethereumEvents';
  const method = 'signedAddEthereumLog';
  const { eventType, ethereumTransactionHash } = call.params;
  const methodParams = [eventType, ethereumTransactionHash];

  try {
    if (utils.isValidEventType(eventType) === false) throw 'eventType';
    if (utils.isValidEthereumTransactionHash(ethereumTransactionHash) === false) throw 'ethereumTransactionHash';
  } catch (param) {
    return utils.buildErrorBody('params', 'invalid ' + param, param, request, call.id);
  }

  return await processProxyMethod(call, request, requestId, pallet, method, methodParams);
}

async function processProxyTokenLower(call, request, requestId) {
  const pallet = 'tokenManager';
  const method = 'signedLower';
  const { user, token, amount, t1Recipient } = call.params;
  const methodParams = [user, token, amount, t1Recipient];

  try {
    if (utils.isValidAccountId(user) === false) throw 'user';
    if (utils.isValidEthereumAddress(token) === false) throw 'token';
    if (utils.isValidAmount(amount) === false) throw 'amount';
    if (utils.isValidEthereumAddress(t1Recipient) === false) throw 't1Recipient';
  } catch (param) {
    return utils.buildErrorBody('params', 'invalid ' + param, param, request, call.id);
  }

  return await processProxyMethod(call, request, requestId, pallet, method, methodParams);
}

async function processProxyCreateNftBatch(call, request, requestId) {
  const pallet = 'nftManager';
  const method = 'signedCreateBatch';
  const { totalSupply, royalties, t1Authority } = call.params;
  const methodParams = [totalSupply, royalties, t1Authority];

  try {
    if (utils.isValidNumber(totalSupply) === false) throw 'totalSupply';
    if (utils.isValidArray(royalties) === false) throw 'royalties';
    if (utils.isValidEthereumAddress(t1Authority) === false) throw 't1Authority';
  } catch (param) {
    return utils.buildErrorBody('params', 'invalid ' + param, param, request, call.id);
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
    return utils.buildErrorBody('params', 'invalid ' + param, param, request, call.id);
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
    return utils.buildErrorBody('params', 'invalid ' + param, param, request, call.id);
  }

  return await processProxyMethod(call, request, requestId, pallet, method, methodParams);
}

async function processProxyListNftBatchForSale(call, request, requestId) {
  const pallet = 'nftManager';
  const method = 'signedListBatchForSale';
  const { batchId, market } = call.params;
  const methodParams = [batchId, market];

  try {
    if (utils.isValidNftId(batchId) === false) throw 'batch ID';
    if (utils.isValidMarket(market) === false) throw 'market';
  } catch (param) {
    return utils.buildErrorBody('params', 'invalid ' + param, param, request, call.id);
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
    return utils.buildErrorBody('params', 'invalid ' + param, param, request, call.id);
  }

  return await processProxyMethod(call, request, requestId, pallet, method, methodParams);
}

async function processProxyMintBatchNft(call, request, requestId) {
  const pallet = 'nftManager';
  const method = 'signedMintBatchNft';
  const { batchId, index, owner, externalRef } = call.params;
  const methodParams = [batchId, index, owner, externalRef];

  try {
    if (utils.isValidNftId(batchId) === false) throw 'batch ID';
    if (utils.isValidNumber(index) === false) throw 'index';
    if (utils.isValidAccountId(owner) === false) throw 'owner';
    if (utils.isValidString(externalRef) === false) throw 'externalRef';
  } catch (param) {
    return utils.buildErrorBody('params', 'invalid ' + param, param, request, call.id);
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
    return utils.buildErrorBody('params', 'invalid ' + param, param, request, call.id);
  }

  return await processProxyMethod(call, request, requestId, pallet, method, methodParams);
}

async function processProxyMethod(call, request, requestId, pallet, method, methodParams) {
  const { relayer, user, payer, proxySignature, feePaymentSignature, paymentNonce } = call.params;

  try {
    validateMethodParams(relayer, user, payer, proxySignature, feePaymentSignature, paymentNonce);
  } catch (err) {
    return utils.buildErrorBody('params', 'Invalid proxy method parameters', err.toString(), request, call.id);
  }


  const proxyProof = utils.getProxyProof(user, relayer, proxySignature);
  const paymentInfo = await fees.tryGetPaymentInfo(AVN_CONNECTOR_ENDPOINT, payer, relayer, feePaymentSignature, call.method, paymentNonce, proxyProof);

  const params = {
    proxyParams: [proxyProof].concat(methodParams),
    relayerAddress: relayer,
    paymentInfo
  };

  return await sendTx(call, request, requestId, pallet, method, params);
}


async function processProxyStakeAvt(call, request, requestId) {
  const pallet = 'validatorsManager';
  const method = 'signedNominate';
  const numSlashSpan = 0;
  const methodParams = [numSlashSpan];

  try {
    if (utils.isValidArray(call.params.targets) === false || call.params.targets.length === 0) throw 'targets';
  } catch (errParam) {
    throw new Error(`invalid parameter (${errParam}) passed to getNominateParams`);
  }

  return await processProxyMethod(call, request, requestId, pallet, method, methodParams);
}

async function processProxyIncreaseStake(call, request, requestId) {
  const pallet = 'validatorsManager';
  const method = 'signedBondExtra';
  const { amount } = call.params;
  const methodParams = [amount];

  try {
    if (utils.isValidAmount(amount) === false) throw 'amount';
  } catch (param) {
    return utils.buildErrorBody('params', 'invalid ' + param, param, request, call.id);
  }

  return await processProxyMethod(call, request, requestId, pallet, method, methodParams);
}

async function processProxyUnstake(call, request, requestId) {
  const pallet = 'validatorsManager';
  const method = 'signedUnbond';
  const { amount } = call.params;
  const methodParams = [amount];

  try {
    if (utils.isValidAmount(amount) === false) throw 'amount';
  } catch (param) {
    return utils.buildErrorBody('params', 'invalid ' + param, param, request, call.id);
  }

  return await processProxyMethod(call, request, requestId, pallet, method, methodParams);
}

async function processProxyWithdrawUnlocked(call, request, requestId) {
  const pallet = 'validatorsManager';
  const method = 'signedWithdrawUnbonded';
  const numSlashSpan = 0;
  const methodParams = [numSlashSpan];

  return await processProxyMethod(call, request, requestId, pallet, method, methodParams);
}

function validateMethodParams(relayer, user, payer, proxySignature, feePaymentSignature, paymentNonce) {
  try {
    if (utils.isValidAccountId(relayer) === false) throw 'relayer';
    if (utils.isValidAccountId(user) === false) throw 'user';
    if (utils.isValidAccountId(payer) === false) throw 'payer';
    if (utils.isValidSignatureFormat(proxySignature) === false) throw 'proxy signature format';
    if (utils.isValidSignatureFormat(feePaymentSignature) === false) throw 'fee signature format';
    if (utils.isValidNonce(paymentNonce) === false) throw 'payment nonce';
  } catch (errParam) {
    throw new Error(`invalid parameter (${errParam}) passed to validateMethodParams`);
  }
}

async function sendTx(call, request, requestId, palletName, method, params) {
  try {
    const queue = process.env.MQ_AVN_TX_QUEUE;
    const txType = 'avnProxy';
    const result = await mqSender.sendMessageToMQ(queue, { requestId, txType, palletName, method, params });
    return utils.buildValidResponseBody(call.id, result);
  } catch (err) {
    return utils.buildErrorBody('internal', 'failed to send proxy transaction', err.toString(), request, call.id);
  }
}
