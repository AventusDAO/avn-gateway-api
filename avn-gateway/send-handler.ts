import * as utils from '/opt/utils';
import * as sqs from '/opt/sqsUtils';
import { ValidRequestContext, Transaction } from './types';
// @ts-ignore
import { APIGatewayProxyEvent, Context, APIGatewayProxyResult } from 'aws-lambda';

const axios = utils.axios;

const AVN_CONNECTOR_ENDPOINT: string | undefined = process.env.AVN_CONNECTOR_ENDPOINT;
const SQS_DEFAULT_QUEUE_URL: string | undefined = process.env.SQS_DEFAULT_QUEUE_URL;
const SQS_PAYER_QUEUE_URL: string | undefined = process.env.SQS_PAYER_QUEUE_URL;

export const handler = async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
  await utils.init();
  const result = await utils.callWithTimeout(context.getRemainingTimeInMillis(), processRequest, [event, context]);

  if (utils.requestFailed(result)) {
    return utils.buildErrorResponse(500, result.error.data, JSON.stringify(result));
  }

  return utils.buildSuccessResponse(JSON.stringify(result));
};

async function processRequest(event: APIGatewayProxyEvent, context: Context): Promise<any> {
  const authoriserContext: ValidRequestContext = event.requestContext.authorizer.lambda;
  const awsRequestId: string = context.awsRequestId;
  let request: string = event.body || '';
  let tx: Transaction;

  try {
    tx = JSON.parse(request);
  } catch (err) {
    return utils.buildErrorBody('parse', 'Failed to parse JSON', err.toString(), request, null);
  }

  try {
    console.info('TX_ID <-> AWS_REQUESTID:', tx.id + ' : ' + awsRequestId);

    //Update redis with requestId. This prevents a "transaction not found" message when polling directly after sending
    await axios.post(AVN_CONNECTOR_ENDPOINT + 'addNewTransactionStatus', { requestId: awsRequestId });

    if (isSplitFeeTransaction(authoriserContext) === true) {
      const eventType = utils.WEBHOOK_EVENT_TYPES.tx_received;
      await utils.publishEvent(AVN_CONNECTOR_ENDPOINT, eventType, awsRequestId, authoriserContext.splitFeePayerAddress, tx);
      const data = await sendMessageToPayerQueue(tx, request, awsRequestId, authoriserContext);
      console.info(`Sent split fee transaction to SQS. txID: ${tx.id}, awsRequestId: ${awsRequestId}, sqsMessageId: ${data.MessageId}`);
    } else {
      const data = await sendMessageToDefaultQueue(tx, awsRequestId);
      console.info(`Sent self pay transaction to SQS. txID: ${tx.id}, awsRequestId: ${awsRequestId}, sqsMessageId: ${data.MessageId}`);
    }

    return utils.buildValidResponseBody(tx.id, awsRequestId);
  } catch (err: any) {
    // Let the caller know that this transaction has failed to be sent to the chain
    await utils.axios.post(`${AVN_CONNECTOR_ENDPOINT}setTransactionFailedToBeSentStatus`, { requestId: awsRequestId });

    return utils.buildErrorBody('internal', 'Failed to handle send transaction', err.toString(), request, tx.id);
  }
}

async function sendMessageToDefaultQueue(tx: Transaction, awsRequestId: string): Promise<any> {
  tx.awsRequestId = awsRequestId;
  return await sqs.sendToQueue(SQS_DEFAULT_QUEUE_URL, tx);
}

async function sendMessageToPayerQueue(tx: Transaction, request: string, awsRequestId: string, authoriserContext: ValidRequestContext): Promise<any> {
  if (tx.params && tx.params.feePaymentSignature) throw new Error('Split fee transaction already contains payment info');
  tx.splitFeePayerId = authoriserContext.splitFeePayerId!;
  tx.splitFeePayerAddress = authoriserContext.splitFeePayerAddress!;
  tx.splitFeePayerVaultId = authoriserContext.splitFeePayerVaultId!;
  tx.awsRequestId = awsRequestId;
  return sqs.sendToQueue(SQS_PAYER_QUEUE_URL, tx);
}

function isSplitFeeTransaction(authoriserContext: ValidRequestContext): boolean {
  if (!authoriserContext.splitFeePayerAddress) return false;
  return authoriserContext.isSplitFeeUser === true && utils.isValidAccountId(authoriserContext.splitFeePayerAddress);
}
