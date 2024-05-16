import { SQSClient, ReceiveMessageCommand, DeleteMessageBatchCommand, Message } from '@aws-sdk/client-sqs';
import avn from './avn';
import webhooks from './webhooks';
const config = require('multiconfig').load();
import log4js from 'log4js';
const logger = log4js.configure(config.log4Js).getLogger();
const sqsClient = new SQSClient({ region: config.aws.region });

const SQS_TX_QUEUE_URL = config.sqs.txQueueUrl;
const PROCESSING_DELAY_MS = 20000;

interface TxData {
  requestId: string;
  txType: string;
  palletName?: string;
  method?: string;
  params?: any;
  toBlock?: number;
  unprocessedLifts?: any[];
}

async function processTxQueue(): Promise<void> {
  while (true) {
    try {
      await processQueue();
    } catch (error) {
      logger.error('[SQS tx] Error processing queue:', error);
      await delay(PROCESSING_DELAY_MS);
    }
  }
}

async function processQueue(): Promise<void> {
  const messages = await receiveMessages();
  logger.info(`[SQS tx] Messages to process: ${messages.length}`);
  if (messages.length === 0) return;

  const processed = await processMessages(messages);
  if (processed.length === 0) return;
  logger.info(`[SQS tx] Messages processed: ${processed.length}`);

  const deleted = await deleteMessages(processed);
  logger.info(`[SQS tx] Messages deleted: ${deleted}`);
}

async function receiveMessages(): Promise<Message[]> {
  const receiveParams = {
    QueueUrl: SQS_TX_QUEUE_URL,
    MaxNumberOfMessages: 10, // 10 is the max possible
    WaitTimeSeconds: 20 // wait max time for messages to arrive to minimize AWS costs
  };
  const received = await sqsClient.send(new ReceiveMessageCommand(receiveParams));
  return received.Messages || [];
}

async function processMessages(messages: Message[]): Promise<Message[]> {
  const processed: Message[] = [];
  for (const message of messages) {
    try {
      await processMessage(message);
      processed.push(message);
    } catch (error) {
      logger.error(`[SQS tx] Error processing message ${message.MessageId}`, error);
      break; // Stop processing on the first error to continue from the same point on retry
    }
  }
  return processed;
}

async function processMessage(message: Message): Promise<void> {
  const txData: TxData = JSON.parse(message.Body!);
  const { requestId, txType } = txData;
  let result;

  switch (txType) {
    case 'avnProxy':
      logger.trace(`[SQS tx] Request ID: ${requestId} - sending proxy transaction: ${JSON.stringify(txData)}`);
      const { palletName, method, params } = txData;

      if (isSplitFeeTransaction(txData)) {
        const payerAddress = params.splitFeePayerAddress;
        params.paymentNonce = await avn.getPayerPaymentNonce(requestId, payerAddress);
        logger.trace(`[SQS tx] Request ID: ${requestId} - split fee payment nonce: ${params.paymentNonce}`);
        params.paymentInfo = await avn.generateSplitFeePaymentInfo(requestId, params, params.paymentNonce);
        const eventType = webhooks.WEBHOOK_EVENT_TYPES.tx_payer_accepted;
        const eventData = { tx: txData, payment: params.paymentInfo };
        webhooks.publishEvent({ eventType, requestId, accountId: payerAddress, data: eventData });
      }

      result = await avn.proxy(requestId, palletName!, method!, params);
      logger.trace(`[SQS tx] Request ID: ${requestId} - proxy transaction sent: ${JSON.stringify(result)}`);
      break;

    case 'avnProcessLifts':
      logger.trace(`[SQS tx] Request ID: ${requestId} - sending lift transaction: ${JSON.stringify(txData)}`);
      const { toBlock, unprocessedLifts } = txData;
      result = await avn.processLifts(requestId, toBlock!, unprocessedLifts!);
      logger.trace(`[SQS tx] Request ID: ${requestId} - lift transaction sent: ${JSON.stringify(result)}`);
      break;

    default:
      logger.error(`[SQS tx] Request ID: ${requestId} - Unsupported transaction type: "${txType}"`);
  }
}

async function deleteMessages(messages: Message[]): Promise<number> {
  let entries = messages.map(message => ({ Id: message.MessageId!, ReceiptHandle: message.ReceiptHandle! }));
  let numDeleted = 0;

  for (let attempt = 1; attempt <= 2; attempt++) {
    const result = await sqsClient.send(new DeleteMessageBatchCommand({ QueueUrl: SQS_TX_QUEUE_URL, Entries: entries }));
    numDeleted += (result.Successful || []).length;
    if (result.Failed === undefined) break;

    if (attempt === 1) {
      const deletedMessages = new Set(result.Successful!.map(message => message.Id));
      entries = entries.filter(entry => !deletedMessages.has(entry.Id));
    } else {
      logger.error('[SQS tx] Failed to delete processed messages after retry:', result.Failed);
    }
  }

  return numDeleted;
}

function isSplitFeeTransaction(request: TxData): boolean {
  return !!request.params?.splitFeePayerAddress;
}

function delay(duration: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, duration));
}

export { processTxQueue };
