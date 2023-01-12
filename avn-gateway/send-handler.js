const utils = require('/opt/utils.js');

const { SQSClient, SendMessageCommand } = require("@aws-sdk/client-sqs");
const sqsClient = new SQSClient({ region: process.env.AWS_REGION });

const DEFAULT_SQS_URL = process.env.SQS_DEFAULT_QUEUE_URL;
const PAYER_SQS_URL = process.env.SQS_PAYER_QUEUE_URL;

exports.handler = async (event, context) => {
  const result = await processRequest(event.body, event.requestContext.authorizer.lambda, context.awsRequestId);

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
    return utils.buildErrorBody('parse', 'failed to parse JSON', err, request, null);
  }

  try {
    console.info('TX_ID <-> AWS_REQUESTID:', tx.id + ' : ' + awsRequestId);

    if (isSplitFeeTransaction(authoriserContext) === true)
    {
      const data = sendMessageToPayerQueue(tx);
      console.info(`Sent split fee transaction to SQS. txID: ${tx.id}, awsRequestId: ${awsRequestId}, sqsMessageId: ${data.MessageId}`);
    } else {
      const data = sendMessageToDefaultQueue(tx);
      console.info(`Sent self pay transaction to SQS. txID: ${tx.id}, awsRequestId: ${awsRequestId}, sqsMessageId: ${data.MessageId}`);
    }

    return utils.buildValidResponseBody(tx.id, awsRequestId);
  } catch (err) {
    return utils.buildErrorBody('internal', 'failed to handle send transaction', err, request, tx.id);
  }
}

async function sendMessageToDefaultQueue(tx, awsRequestId) {
  const messageBody = JSON.stringify(tx);
  const params = {
    QueueUrl: DEFAULT_SQS_URL,
    MessageGroupId: 'DEFAULT',
    MessageDeduplicationId: utils.hashString(messageBody),
    MessageBody: messageBody,
  };

  tx.awsRequestId = awsRequestId;
  return await sqsClient.send(new SendMessageCommand(params));
}

async function sendMessageToPayerQueue(tx, awsRequestId) {
  const messageBody = JSON.stringify(tx);
  const params = {
    QueueUrl: PAYER_SQS_URL,
    MessageGroupId: 'PAYER',
    MessageDeduplicationId: utils.hashString(messageBody),
    MessageBody: messageBody,
  };

  if (tx.paymentInfo) return utils.buildErrorBody('internal', 'split fee tx already contains payment info', tx.paymentInfo, request, tx.id);

  tx.splitFeePayerAddress = splitFeePayerAddress;
  tx.awsRequestId = awsRequestId;
  return await sqsClient.send(new SendMessageCommand(params));
}

function isSplitFeeTransaction(authoriserContext) {
  const hasValidPayer = authoriserContext.splitFeePayerAddress && utils.isValidAccountId(authoriserContext.splitFeePayerAddress);
  return authoriserContext.isSplitFeeUser === true && hasValidPayer
}
