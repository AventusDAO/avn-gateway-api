const { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } = require('@aws-sdk/client-sqs');
const avn = require('./avn');
const config = require('multiconfig').load();
const logger = require('log4js').configure(config.log4Js).getLogger();
const sqsClient = new SQSClient({ region: config.aws.region });
const SQS_TX_QUEUE_URL = config.tx.sqsTxQueueUrl;
const AVN_TX_RETRY_COUNT = config.tx.avnTxRetryCount;
const AVN_TX_RETRY_DELAY = config.tx.avnTxRetryDelay;

const receiveParams = {
  QueueUrl: SQS_TX_QUEUE_URL,
  MaxNumberOfMessages: 10, // 10 is the max possible
  WaitTimeSeconds: 20 // Long polling - use 20 second max to wait for messages to arrive - minimizes AWS costs
};

async function processTxFromQueue() {
  while (true) {
    try {
      const receivedMessages = await sqsClient.send(new ReceiveMessageCommand(receiveParams));
      if (receivedMessages.Messages) {
        for (const message of receivedMessages.Messages) {
          const id = message.MessageId;
          const txData = JSON.parse(message.Body);
          logger.info(`Received message ID: ${id} - tx data: ${txData}`);
          await trySendAvnTx(txData);
          await sqsClient.send(new DeleteMessageCommand({ QueueUrl: SQS_TX_QUEUE_URL, ReceiptHandle: message.ReceiptHandle }));
          logger.info(`Deleted message ID: ${id}`);
        }
      }
    } catch (error) {
      logger.error('Error processing messages:', error);
      // 20 second delay to avoid a tight loop in case of any persistent error
      await new Promise(resolve => setTimeout(resolve, 20000));
    }
  }
}

async function trySendAvnTx(txData) {
  let retries = 0;

  while (retries <= AVN_TX_RETRY_COUNT) {
    try {
      return await sendAvnTx(txData);
    } catch (error) {
      retries++;

      if (retries <= AVN_TX_RETRY_COUNT) {
        logger.warn(`sendAvnTx failed ${retries} time(s), retrying. Error: ${errror.message}`);
        await new Promise(resolve => setTimeout(resolve, AVN_TX_RETRY_DELAY));
      } else {
        return logger.error(`Error sending tx - message ID: ${id}`, error);
      }
    }
  }
}

async function sendAvnTx(request) {
  let result = null;
  let { requestId, txType } = request;

  switch (txType) {
    case 'avnProxy':
      logger.info(`${requestId} - Processing new transaction from queue: ${JSON.stringify(request)}`);
      const { palletName, method, params } = request;

      if (isSplitFeeTransaction(request)) {
        const paymentNonce = await avn.getPayerPaymentNonce(requestId, request.params.splitFeePayerAddress);
        logger.trace(`${requestId} - Split fee transaction. Payment nonce: ${paymentNonce}`);
        params.paymentInfo = await avn.generateSplitFeePaymentInfo(requestId, params, paymentNonce);
        params.paymentNonce = paymentNonce;
      }

      result = await avn.proxy(requestId, palletName, method, params);
      logger.info(`${requestId} - Processing completed. Result: ${JSON.stringify(result)}`);
      break;

    case 'avnProcessLifts':
      logger.info(`${requestId} - Processing lift transaction from queue: ${JSON.stringify(request)}`);
      const { toBlock, unprocessedLifts } = request;
      result = await avn.processLifts(requestId, toBlock, unprocessedLifts);
      logger.info(`${requestId} - Processing completed. Result: ${JSON.stringify(result)}`);
      break;

    default:
      throw Error('Transaction type not supported');
  }
}

function isSplitFeeTransaction(request) {
  return !!request.params.splitFeePayerAddress;
}

module.exports = { processTxFromQueue };
