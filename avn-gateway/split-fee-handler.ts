
import { init, callWithTimeout, requestFailed, buildErrorBody, publishEvent, getRelayerFee,
  buildValidResponseBody, isValidAccountId, isValidString, axios, isValidSignatureFormat,
  WEBHOOK_EVENT_TYPES } from '/opt/utils.js';
import * as fees from '/opt/paymentUtils.js';
import * as sqs from '/opt/sqsUtils.js';
import { StatusCode, CustomSQSHandler, ValidResponse, Transaction } from '/opt/handler-types';
import { ErrorBody } from '/opt/types';
// @ts-ignore
import { SQSEvent, Context, SQSBatchResponse, APIGatewayProxyResult } from 'aws-lambda';

const AVN_CONNECTOR_ENDPOINT = process.env.AVN_CONNECTOR_ENDPOINT!;
const SQS_DEFAULT_QUEUE_URL = process.env.SQS_DEFAULT_QUEUE_URL!;

export const handler: CustomSQSHandler = async (event: SQSEvent, context: Context): Promise<SQSBatchResponse|APIGatewayProxyResult> => {
  await init();
  let processedMessagesCount = 0;

  try {
    if (!event.Records) {
      console.info(`No messages to process.`);
      return {
        statusCode: StatusCode.OK,
        body: `No messages to process`
      };
    }

    console.info(`Processing ${event.Records.length} message(s) from queue`);
    for (let record of event.Records) {
      const result = await callWithTimeout(context.getRemainingTimeInMillis(), processRequest, [record.body]);
      if (requestFailed(result) === true) {
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
      statusCode: StatusCode.OK,
      body: `${event.Records.length} message(s) processed successfully.`
    };
  } catch (err) {
    console.error(`Failed to process messages from payer queue: `, err);

    return {
      batchItemFailures: sqs.getFailedMessagesForFifoQueue(event.Records, processedMessagesCount)
    };
  }
};

async function processRequest(request: string): Promise<ValidResponse | ErrorBody> {
  let tx: Transaction;
  let requestId: string;

  try {
    tx = JSON.parse(request);
    requestId = tx.awsRequestId;
  } catch (err) {
    console.error(`Failed to parse message as JSON: `, err);
    return buildErrorBody('parse', 'Failed to parse message as JSON', err.toString(), request, null);
  }

  try {
    console.info('CALLID_TO_REQUESTID:', tx.id + ' : ' + requestId);
    validateTransaction(tx);

    if ((await payerCanPayForTransaction(tx.splitFeePayerAddress, tx.method)) === false) {
      // transaction has been rejected by payer, inform user
      const eventType = WEBHOOK_EVENT_TYPES.tx_payer_refused;
      await publishEvent(AVN_CONNECTOR_ENDPOINT, eventType, requestId, tx.splitFeePayerAddress, tx);
      await updateTransactionStatusToRejected(requestId);
      return;
    }

    const relayerFee = await getRelayerFee(AVN_CONNECTOR_ENDPOINT, tx.params.relayer, tx.splitFeePayerAddress, tx.method);
    tx.params.payer = tx.splitFeePayerAddress;
    tx.relayerFee = relayerFee;

    const data = await sqs.sendToQueue(SQS_DEFAULT_QUEUE_URL, tx);
    const eventType = WEBHOOK_EVENT_TYPES.tx_queued;
    await publishEvent(AVN_CONNECTOR_ENDPOINT, eventType, requestId, tx.splitFeePayerAddress, tx);
    console.info(
      `Sent updated transaction to default SQS. txID: ${tx.id}, awsRequestId: ${tx.awsRequestId}, sqsMessageId: ${data.MessageId}`
    );
    return buildValidResponseBody(tx.id, requestId);
  } catch (err) {
    console.error(`Failed to process message from split fee queue: `, err);
    return buildErrorBody('request', 'Failed to process message from split fee queue', err.toString(), request, tx.id);
  }
}

function validateTransaction(tx: Transaction): void {
  try {
    if (isValidAccountId(tx.params.relayer) === false) throw 'relayer';
    if (isValidAccountId(tx.params.user) === false) throw 'user';
    if (isValidString(tx.splitFeePayerVaultId) === false) throw 'splitFeePayerVaultId';
    if (isValidAccountId(tx.splitFeePayerAddress) === false) throw 'splitFeePayerAddress';
    if (isValidSignatureFormat(tx.params.proxySignature) === false) throw 'proxy signature format';
  } catch (errParam) {
    throw new Error(`Invalid transaction data: ${errParam}`);
  }
}

async function payerCanPayForTransaction(payerAddress: string, transactionName: string): Promise<Boolean> {
  try {
    const avnResponse = await axios.post(AVN_CONNECTOR_ENDPOINT + 'isPayerTransaction', {
      payer: payerAddress,
      transaction: transactionName
    });

    return avnResponse.data === true;
  } catch (err) {
    console.error(`Failed to check if payer ${payerAddress} can pay for transaction ${transactionName}:`, err.toString());
    throw err;
  }
}

async function updateTransactionStatusToRejected(requestId: string): Promise<void> {
  try {
    await axios.post(AVN_CONNECTOR_ENDPOINT + 'setTransactionRefusedByPayerStatus', { requestId: requestId });
  } catch (err) {
    console.error(`Failed to set status of requestId ${requestId} as 'Rejected by payer':`, err.toString());
    throw err;
  }
}
