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
  logger.info(`[SQS tx] Messages to process: ${received.Messages?.length || 0}`);
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
      break; // We stop processing on the first error to continue from the same point on any retry
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
      logger.trace(`[SQS tx] Request ID: ${requestId} - sending proxy transaction: ${JSON.stringify(txData)}`);
      const { palletName, method, params } = txData;

      if (isSplitFeeTransaction(txData)) {
        const paymentNonce = await avn.getPayerPaymentNonce(requestId, params.splitFeePayerAddress);
        logger.trace(`[SQS tx] Request ID: ${requestId} - split fee payment nonce: ${paymentNonce}`);
        params.paymentInfo = await avn.generateSplitFeePaymentInfo(requestId, params, paymentNonce);
        params.paymentNonce = paymentNonce;
      }

      result = await avn.proxy(requestId, palletName, method, params);
      logger.trace(`[SQS tx] Request ID: ${requestId} - proxy transaction sent: ${JSON.stringify(result)}`);
      break;

    case 'avnProcessLifts':
      logger.trace(`[SQS tx] Request ID: ${requestId} - sending lift transaction: ${JSON.stringify(txData)}`);
      const { toBlock, unprocessedLifts } = txData;
      result = await avn.processLifts(requestId, toBlock, unprocessedLifts);
      logger.trace(`[SQS tx] Request ID: ${requestId} - lift transaction sent: ${JSON.stringify(result)}`);
      break;

    default:
      logger.error(`[SQS tx] Request ID: ${requestId} - Unsupported transaction type: "${txType}" - message removed`);
  }
}

function isSplitFeeTransaction(params) {
  return !!params.splitFeePayerAddress;
}

async function deleteProcessedMessages(entries) {
  let deleted = 0;

  for (let attempt = 0; attempt < 2; attempt++) {
    if (entries.length === 0) break; // No entries, exit
    const result = await sqsClient.send(new DeleteMessageBatchCommand({ QueueUrl: SQS_TX_QUEUE_URL, Entries: entries }));
    if (result.Successful !== undefined) deleted += result.Successful.length;
    if (result.Failed === undefined) break; // No failed deletions, exit

    if (attempt === 0) {
      logger.error('[SQS tx] Failed to delete processed messages:', result.Failed);
      const deletedIds = new Set(result.Successful.map(s => s.Id));
      entries = entries.filter(entry => !deletedIds.has(entry.Id));
    } else {
      logger.error('[SQS tx] Failed to delete processed messages after retry:', result.Failed);
    }
  }

  logger.info(`[SQS tx] Processed messages deleted successfully: ${deleted}`);
}

module.exports = { processTxQueue };
