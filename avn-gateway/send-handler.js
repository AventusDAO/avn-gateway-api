const utils = require('/opt/utils.js');
const sqs = require('/opt/sqsUtils.js');

const sqsClient = new sqs.SQSClient({ region: process.env.SECRET_MANAGER_REGION });

const DEFAULT_SQS_URL = process.env.SQS_DEFAULT_QUEUE_URL;
const PAYER_SQS_URL = process.env.SQS_PAYER_QUEUE_URL;

exports.handler = async (event, context) => {
<<<<<<< HEAD
  try {
    await connectToMQ();
  } catch (err) {
    return {
      statusCode: 500,
      error: { message: err.message },
      body: JSON.stringify(utils.buildErrorBody('internal', 'failed to connect to queue', err, event.body, null))
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
    return utils.buildErrorBody('parse', 'failed to parse JSON', err, request, null);
  }

  if (call.id === undefined) call.id = null;
  console.info('CALLID_TO_REQUESTID:', call.id + ':' + requestId);

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
=======
  const result = await processRequest(event.body, event.requestContext.authorizer.lambda, context.awsRequestId);
>>>>>>> Remove_era_election_status

  if (utils.requestFailed(result) === true) {
    return utils.buildErrorResponse(500, result.error.data, JSON.stringify(result));
  }

  return utils.buildSuccessResponse(JSON.stringify(result))
};

async function processRequest(request, authoriserContext, awsRequestId) {
  let tx;

  try {
    tx = JSON.parse(request);
  } catch (err) {
    return utils.buildErrorBody('parse', 'failed to parse JSON', err.toString(), request, null);
  }

  try {
    console.info('TX_ID <-> AWS_REQUESTID:', tx.id + ' : ' + awsRequestId);

    if (isSplitFeeTransaction(authoriserContext) === true)
    {
      const data = await sendMessageToPayerQueue(tx, request, awsRequestId, authoriserContext);
      console.info(`Sent split fee transaction to SQS. txID: ${tx.id}, awsRequestId: ${awsRequestId}, sqsMessageId: ${data.MessageId}`);
    } else {
      const data = await sendMessageToDefaultQueue(tx, awsRequestId);
      console.info(`Sent self pay transaction to SQS. txID: ${tx.id}, awsRequestId: ${awsRequestId}, sqsMessageId: ${data.MessageId}`);
    }

    return utils.buildValidResponseBody(tx.id, awsRequestId);
  } catch (err) {
    return utils.buildErrorBody('internal', 'failed to handle send transaction', err.toString(), request, tx.id);
  }
}

async function sendMessageToDefaultQueue(tx, awsRequestId) {
  tx.awsRequestId = awsRequestId;
  const messageBody = JSON.stringify(tx);

<<<<<<< HEAD
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
=======
  const params = {
    QueueUrl: DEFAULT_SQS_URL,
    MessageGroupId: 'DEFAULT',
    MessageDeduplicationId: utils.hashString(messageBody),
    MessageBody: messageBody,
  };

  return await sqsClient.send(new sqs.SendMessageCommand(params));
>>>>>>> Remove_era_election_status
}

async function sendMessageToPayerQueue(tx, request, awsRequestId, authoriserContext) {
  tx.splitFeePayerAddress = authoriserContext.splitFeePayerAddress;
  tx.awsRequestId = awsRequestId;
  const messageBody = JSON.stringify(tx);

  const params = {
    QueueUrl: PAYER_SQS_URL,
    MessageGroupId: 'PAYER',
    MessageDeduplicationId: utils.hashString(messageBody),
    MessageBody: messageBody,
  };

  if (tx.params.feePaymentSignature) throw new Error('split fee tx already contains payment info');

  return await sqsClient.send(new sqs.SendMessageCommand(params));
}

function isSplitFeeTransaction(authoriserContext) {
  if (!authoriserContext.splitFeePayerAddress) {
    return false;
  }

  const hasValidPayer = utils.isValidAccountId(authoriserContext.splitFeePayerAddress);
  return authoriserContext.isSplitFeeUser === true && hasValidPayer === true
}
