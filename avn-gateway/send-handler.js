const utils = require('/opt/utils.js');
const sqs = require('/opt/sqsUtils.js');

const sqsClient = new sqs.SQSClient({ region: process.env.AWS_REGION });

const DEFAULT_SQS_URL = process.env.SQS_DEFAULT_QUEUE_URL;
const PAYER_SQS_URL = process.env.SQS_PAYER_QUEUE_URL;
const AVN_CONNECTOR_ENDPOINT = process.env.AVN_CONNECTOR_ENDPOINT;

exports.handler = async (event, context) => {
  let result;
  const timeoutMs = context.getRemainingTimeInMillis() - utils.ONE_SECOND;
  if (timeoutMs > 0) {
    result = await utils.callWithTimeout(timeoutMs, processRequest, [
      event.body,
      event.requestContext.authorizer.lambda,
      context.awsRequestId
    ]);
  } else {
    throw new Error('Lambda execution exceeded allowed time');
  }

  if (utils.requestFailed(result) === true) {
    return utils.buildErrorResponse(500, result.error.data, JSON.stringify(result));
  }

  return utils.buildSuccessResponse(JSON.stringify(result));
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

    //Update redis with requestId. This prevents a "transaction not found" message when polling directly after sending
    await utils.axios.post(AVN_CONNECTOR_ENDPOINT + 'addNewTransactionStatus', { requestId: awsRequestId });

    if (isSplitFeeTransaction(authoriserContext) === true) {
      const data = await sendMessageToPayerQueue(tx, request, awsRequestId, authoriserContext);
      console.info(
        `Sent split fee transaction to SQS. txID: ${tx.id}, awsRequestId: ${awsRequestId}, sqsMessageId: ${data.MessageId}`
      );
    } else {
      const data = await sendMessageToDefaultQueue(tx, awsRequestId);
      console.info(
        `Sent self pay transaction to SQS. txID: ${tx.id}, awsRequestId: ${awsRequestId}, sqsMessageId: ${data.MessageId}`
      );
    }

    return utils.buildValidResponseBody(tx.id, awsRequestId);
  } catch (err) {
    // Let the caller know that this transaction has failed to be sent to the chain
    await utils.axios.post(AVN_CONNECTOR_ENDPOINT + 'setTransactionFailedToBeSentStatus', { requestId: awsRequestId });

    return utils.buildErrorBody('internal', 'failed to handle send transaction', err.toString(), request, tx.id);
  }
}

async function sendMessageToDefaultQueue(tx, awsRequestId) {
  tx.awsRequestId = awsRequestId;
  const messageBody = JSON.stringify(tx);

  const params = {
    QueueUrl: DEFAULT_SQS_URL,
    MessageGroupId: 'DEFAULT',
    MessageDeduplicationId: utils.hashString(messageBody),
    MessageBody: messageBody
  };

  return await sqsClient.send(new sqs.SendMessageCommand(params));
}

async function sendMessageToPayerQueue(tx, request, awsRequestId, authoriserContext) {
  tx.splitFeePayerId = authoriserContext.splitFeePayerId;
  tx.splitFeePayerAddress = authoriserContext.splitFeePayerAddress;
  tx.splitFeePayerVaultId = authoriserContext.splitFeePayerVaultId;
  tx.awsRequestId = awsRequestId;
  const messageBody = JSON.stringify(tx);

  const params = {
    QueueUrl: PAYER_SQS_URL,
    MessageGroupId: 'PAYER',
    MessageDeduplicationId: utils.hashString(messageBody),
    MessageBody: messageBody
  };

  if (tx.params.feePaymentSignature) throw new Error('split fee tx already contains payment info');

  return await sqsClient.send(new sqs.SendMessageCommand(params));
}

function isSplitFeeTransaction(authoriserContext) {
  if (!authoriserContext.splitFeePayerAddress) {
    return false;
  }

  const hasValidPayer = utils.isValidAccountId(authoriserContext.splitFeePayerAddress);
  return authoriserContext.isSplitFeeUser === true && hasValidPayer === true;
}
