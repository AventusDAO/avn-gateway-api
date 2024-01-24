const { SQSClient, ReceiveMessageCommand, DeleteMessageBatchCommand } = require('@aws-sdk/client-sqs');
const avn = require('./avn');
const config = require('multiconfig').load();
const logger = require('log4js').configure(config.log4Js).getLogger();
const sqsClient = new SQSClient({ region: config.aws.region });

const SQS_TX_QUEUE_URL = config.sqs.txQueueUrl;

async function processTxQueue() {
  while (true) {
    try {
      const messages = await receiveMessages();
      if (messages.length > 0) {
        const processed = await processMessages(messages);
        await deleteProcessedMessages(processed);
      }
    } catch (error) {
      logger.error('[SQS tx] Error processing queue:', error);
      await new Promise(resolve => setTimeout(resolve, 20000)); // 20-second delay to avoid a tight loop
    }
  }
}

async function receiveMessages() {
  const receiveParams = {
    QueueUrl: SQS_TX_QUEUE_URL,
    MaxNumberOfMessages: 10, // 10 is the max possible
    WaitTimeSeconds: 20 // wait max time for messages to arrive to minimize AWS costs
  };
  const received = await sqsClient.send(new ReceiveMessageCommand(receiveParams));
  logger.info(`[SQS tx] Received ${received.Messages?.length || 0} messages`);
  return received.Messages || [];
}

async function processMessages(messages) {
  const processed = [];
  for (const message of messages) {
    try {
      await processMessage(message);
      processed.push({ Id: message.MessageId, ReceiptHandle: message.ReceiptHandle });
    } catch (error) {
      logger.error(`[SQS tx] Error processing message ${message.MessageId}`, error);
    }
  }
  return processed;
}

async function processMessage(message) {
  const txData = JSON.parse(message.Body);
  const { requestId, txType } = txData;
  let result;

  switch (txType) {
    case 'avnProxy':
      logger.trace(`[SQS tx] ${requestId} - Sending proxy transaction: ${JSON.stringify(txData)}`);
      const { palletName, method, params } = txData;

      if (isSplitFeeTransaction(txData)) {
        const paymentNonce = await avn.getPayerPaymentNonce(requestId, params.splitFeePayerAddress);
        logger.trace(`[SQS tx] ${requestId} - Split fee transaction - payment nonce: ${paymentNonce}`);
        params.paymentInfo = await avn.generateSplitFeePaymentInfo(requestId, params, paymentNonce);
        params.paymentNonce = paymentNonce;
      }

      result = await avn.proxy(requestId, palletName, method, params);
      logger.trace(`[SQS tx] ${requestId} - Proxy transaction sent: ${JSON.stringify(result)}`);
      break;

    case 'avnProcessLifts':
      logger.trace(`[SQS tx] ${requestId} - Sending lift transaction: ${JSON.stringify(txData)}`);
      const { toBlock, unprocessedLifts } = txData;
      result = await avn.processLifts(requestId, toBlock, unprocessedLifts);
      logger.trace(`[SQS tx] ${requestId} - Lift transaction sent: ${JSON.stringify(result)}`);
      break;

    default:
      logger.error(`${requestId} - Transaction "${txType}" not supported - will be removed from queue`);
  }
}

function isSplitFeeTransaction(params) {
  return !!params.splitFeePayerAddress;
}

async function deleteProcessedMessages(entries) {
  if (entries.length > 0) {
    const result = await sqsClient.send(new DeleteMessageBatchCommand({ QueueUrl: SQS_TX_QUEUE_URL, Entries: entries }));
    logger.info(`[SQS tx] Successfully processed ${result.Successful?.length || 0} messages`);
    if (result.Failed !== undefined) {
      logger.error('[SQS tx] Failed to delete processed messages:', result.Failed);
    }
  }
}

module.exports = { processTxQueue };
