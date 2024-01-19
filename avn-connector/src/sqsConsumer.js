const { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } = require('@aws-sdk/client-sqs');
const avn = require('./avn');
const config = require('multiconfig').load();
const logger = require('log4js').configure(config.log4Js).getLogger();
const sqsClient = new SQSClient({ region: config.aws.region });
const AVN_TX_QUEUE_URL = config.sqs.avnTxQueueUrl;
const AVN_TX_RETRY_COUNT = config.sqs.avnTxRetryCount;
const AVN_TX_RETRY_DELAY = config.sqs.avnTxRetryDelay;

async function processMessages() {
  const receiveParams = {
    QueueUrl: AVN_TX_QUEUE_URL,
    MaxNumberOfMessages: 10,
    WaitTimeSeconds: 20
  };

  while (true) {
    try {
      const receivedMessages = await sqsClient.send(new ReceiveMessageCommand(receiveParams));
      if (receivedMessages.Messages) {
        for (const message of receivedMessages.Messages) {
          const id = message.MessageId;
          const txData = JSON.parse(message.Body);
          logger.info(`Received message ID: ${id} - tx data: ${txData}`);
          await trySendAvnTx(txData);
          await sqsClient.send(new DeleteMessageCommand({ QueueUrl: AVN_TX_QUEUE_URL, ReceiptHandle: message.ReceiptHandle }));
          logger.info(`Deleted message ID: ${id}`);
        }
      } else {
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    } catch (error) {
      logger.error({ message: 'Error processing messages:', error });
      await new Promise(resolve => setTimeout(resolve, 20000));
    }
  }
}

async function trySendAvnTx(txData) {
  let retries = 0;

  while (retries <= AVN_TX_RETRY_COUNT) {
    try {
      return await sendAvnTx(txData);
    } catch (err) {
      retries++;

      if (retries <= AVN_TX_RETRY_COUNT) {
        logger.warn(`sendAvnTx failed ${retries} time(s), retrying. Error: ${err.message}`);
        await new Promise(resolve => setTimeout(resolve, AVN_TX_RETRY_DELAY));
      } else {
        logger.error('sendAvnTx err', err);
        throw err;
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

module.exports = { processMessages };
