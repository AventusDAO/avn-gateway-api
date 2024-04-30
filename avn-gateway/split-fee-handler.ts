import * as utils from '/opt/utils.js';
import * as fees from '/opt/paymentUtils.js';
import * as sqs from '/opt/sqsUtils.js';
import { Handler, SQSEvent, Context, SQSBatchResponse } from 'aws-lambda';

const AVN_CONNECTOR_ENDPOINT = process.env.AVN_CONNECTOR_ENDPOINT!;
const SQS_DEFAULT_QUEUE_URL = process.env.SQS_DEFAULT_QUEUE_URL!;

type InvalidTransactionHandler = Handler<SQSEvent, (SQSBatchResponse|SplitFeeHandlerResponse) | void>

export interface ValidResponse {
  jsonrpc: '2.0';
  id: string;
  result: string;
}

export interface RPCError {
  code: number;
  message: string;
}

export interface ValidError {
  jsonrpc: '2.0';
  id: string;
  error: RPCError & { data: {
    gatewayError: string,
    request: string,
  } };
}

enum StatusCode {
  OK = 200,
  MultiStatus = 207,
  InternalServerError = 500
}

export interface ResponseFormat {
  statusCode: StatusCode,
  body: string,
}

export interface Transaction {
  id: string,
  awsRequestId: string,
  splitFeePayerId: string,
  splitFeePayerVaultId: string,
  splitFeePayerAddress: string,
  method: string,
  relayerFee: number,
  params: {
    user: string,
    relayer: string,
    payer: string,
    proxySignature: string
  }
}

export interface SplitFeeHandlerResponse {
  statusCode: StatusCode;
  body: string;
}

export const handler: InvalidTransactionHandler = async (event: SQSEvent, context: Context): Promise<SQSBatchResponse|SplitFeeHandlerResponse> => {
  await utils.init();
  let processedMessagesCount = 0;

  try {
    if (!event.Records) {
      console.log(`No messages to process.`);
      return {
        statusCode: StatusCode.OK,
        body: `No messages to process`
      };
    }

    console.log(`Processing ${event.Records.length} message(s) from queue`);
    for (let record of event.Records) {
      const result = await utils.callWithTimeout(context.getRemainingTimeInMillis(), processRequest, [record.body]);
      if (utils.requestFailed(result) === true) {
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

async function processRequest(request: string): Promise<ValidResponse | ValidError> {
  let tx: Transaction;
  let requestId: string;

  try {
    tx = JSON.parse(request);
    requestId = tx.awsRequestId;
  } catch (err) {
    console.error(`Failed to parse message as JSON: `, err);
    return utils.buildErrorBody('parse', 'Failed to parse message as JSON', err.toString(), request, null);
  }

  try {
    console.info('CALLID_TO_REQUESTID:', tx.id + ' : ' + requestId);
    validateTransaction(tx);

    if ((await payerCanPayForTransaction(tx.splitFeePayerAddress, tx.method)) === false) {
      // transaction has been rejected by payer, inform user
      const eventType = utils.WEBHOOK_EVENT_TYPES.tx_payer_refused;
      await utils.publishEvent(AVN_CONNECTOR_ENDPOINT, eventType, requestId, tx.splitFeePayerAddress, tx);
      await updateTransactionStatusToRejected(requestId);
      return;
    }

    const relayerFee = await utils.getRelayerFee(AVN_CONNECTOR_ENDPOINT, tx.params.relayer, tx.splitFeePayerAddress, tx.method);
    tx.params.payer = tx.splitFeePayerAddress;
    tx.relayerFee = relayerFee;

    const data = await sqs.sendToQueue(SQS_DEFAULT_QUEUE_URL, tx);
    const eventType = utils.WEBHOOK_EVENT_TYPES.tx_queued;
    await utils.publishEvent(AVN_CONNECTOR_ENDPOINT, eventType, requestId, tx.splitFeePayerAddress, tx);
    console.info(
      `Sent updated transaction to default SQS. txID: ${tx.id}, awsRequestId: ${tx.awsRequestId}, sqsMessageId: ${data.MessageId}`
    );
    return utils.buildValidResponseBody(tx.id, requestId);
  } catch (err) {
    console.error(`Failed to process message from split fee queue: `, err);
    return utils.buildErrorBody('request', 'Failed to process message from split fee queue', err.toString(), request, tx.id);
  }
}

function validateTransaction(tx: Transaction): void {
  try {
    if (utils.isValidAccountId(tx.params.relayer) === false) throw 'relayer';
    if (utils.isValidAccountId(tx.params.user) === false) throw 'user';
    if (utils.isValidNumber(tx.splitFeePayerId) === false) throw 'splitFeePayerId';
    if (utils.isValidString(tx.splitFeePayerVaultId) === false) throw 'splitFeePayerVaultId';
    if (utils.isValidAccountId(tx.splitFeePayerAddress) === false) throw 'splitFeePayerAddress';
    if (utils.isValidSignatureFormat(tx.params.proxySignature) === false) throw 'proxy signature format';
  } catch (errParam) {
    throw new Error(`Invalid transaction data: ${errParam}`);
  }
}

async function payerCanPayForTransaction(payerAddress: string, transactionName: string): Promise<Boolean> {
  try {
    const avnResponse = await utils.axios.post(AVN_CONNECTOR_ENDPOINT + 'isPayerTransaction', {
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
    await utils.axios.post(AVN_CONNECTOR_ENDPOINT + 'setTransactionRefusedByPayerStatus', { requestId: requestId });
  } catch (err) {
    console.error(`Failed to set status of requestId ${requestId} as 'Rejected by payer':`, err.toString());
    throw err;
  }
}
