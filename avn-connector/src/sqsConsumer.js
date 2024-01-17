const AWS = require('aws-sdk');
const avn = require('./avn');
const config = require('multiconfig').load();
const logger = require('log4js').configure(config.log4Js).getLogger();

AWS.config.update({ region: config.aws.region });
const sqs = new AWS.SQS({ apiVersion: '2012-11-05' });

async function connectToSQS() {
  let sqsConsumer = new SQSConsumer();
  await processMessagesFromSQS(sqsConsumer);
}

function SQSConsumer() {
  this.sqsQueueUrl = config.sqs.avnTxQueue;
}

async function processMessagesFromSQS(sqsConsumer) {
  const params = {
    QueueUrl: sqsConsumer.sqsQueueUrl,
    MaxNumberOfMessages: 10,
    WaitTimeSeconds: 20
  };

  sqs.receiveMessage(params, function (err, data) {
    if (err) {
      logger.error('Receive Error', err);
    } else if (data.Messages) {
      data.Messages.forEach(async message => {
        try {
          await processMessage(message);
          const deleteParams = {
            QueueUrl: sqsConsumer.sqsQueueUrl,
            ReceiptHandle: message.ReceiptHandle
          };
          sqs.deleteMessage(deleteParams, function (deleteErr, deleteData) {
            if (deleteErr) {
              logger.error('Delete Error', deleteErr);
            } else {
              logger.info('Message Deleted', deleteData);
            }
          });
        } catch (error) {
          logger.error('Error processing message: ', error);
        }
      });
    }
  });
}

async function processMessage(sqsMessage) {
  try {
    const messageBody = JSON.parse(sqsMessage.Body);
    await trySendAvnTx(messageBody);
  } catch (err) {
    logger.error('Error processing SQS message: ', err);
  }
}

async function trySendAvnTx(message) {
  const avnTxRetryCount = config.sqs.avnTxRetryCount;
  const avnTxRetryDelay = config.sqs.avnTxRetryDelay;
  let retries = 0;

  while (retries <= avnTxRetryCount) {
    try {
      return await sendAvnTx(JSON.parse(message.content.toString()));
    } catch (err) {
      retries++;

      if (retries <= avnTxRetryCount) {
        logger.warn(`sendAvnTx failed ${retries} time(s), retrying. Error: ${err.message}`);
        await new Promise(resolve => setTimeout(resolve, avnTxRetryDelay));
      } else {
        logger.error('sendAvnTx err', err.message);
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

module.exports = { connectToSQS };
