const utils = require('/opt/utils.js');
const fees = require('/opt/paymentUtils.js');
const sqs = require('/opt/sqsUtils.js');
const AVN_CONNECTOR_ENDPOINT = process.env.AVN_CONNECTOR_ENDPOINT;

exports.handler = async (event) => {
  let processedMessagesCount = 0;

  try {

    if (!event.Records) {
      console.log(`No messages to process.`);
      return {
        statusCode: 200,
        body: `No messages to process`
      };
    }

    console.log(`Processing ${event.Records.length} message(s) from queue`);

    for (let record of event.Records) {
      const result = await processRequest(record.body);

      if (utils.requestFailed(result) === false) {
        processedMessagesCount += 1;
      }
    }

    if (processedMessagesCount < event.Records.length) {
      console.warn(`Processed ${processedMessagesCount} out of ${event.Records.length} message(s) successfully.`);
      return {
        batchItemFailures: sqs.getFailedMessagesForFifoQueue(event.Records, processedMessagesCount)
      };
    }

    return {
      statusCode: 200,
      body: `${event.Records.length} message(s) processed successfully.`
    };

  } catch (err) {
    console.error(`Failed to process messages from payer queue: `, err);

    return {
      batchItemFailures: sqs.getFailedMessagesForFifoQueue(event.Records, processedMessagesCount)
    };
  }
};

async function processRequest(request) {
  let tx;
  let requestId;

  try {
    tx = JSON.parse(request);
    requestId = tx.awsRequestId;
  } catch (err) {
    console.error(`Failed to parse message as JSON: `, err);
    throw err;
  }

  console.info('CALLID_TO_REQUESTID:', tx.id + ' : ' + requestId);
  validateTransaction(tx);

  const feeParams = await fees.getSplitFeePaymentParams(AVN_CONNECTOR_ENDPOINT, tx);
  const encodedPaymentParams = fees.encodePaymentParams(feeParams.relayer, feeParams.relayerFee, feeParams.paymentNonce, feeParams.proxyProof);

  const paymentSignature = await signPaymentInfo(tx.splitFeePayerAddress, encodedPaymentParams);

  tx.params.payer = tx.splitFeePayerAddress;
  tx.params.feePaymentSignature = paymentSignature;
  tx.params.paymentNonce = feeParams.paymentNonce;
  // TODO: send message to default queue
  return utils.buildValidResponseBody(tx.id, requestId);
}
function validateTransaction(tx) {
  try {
    if (utils.isValidAccountId(tx.params.relayer) === false) throw 'relayer';
    if (utils.isValidAccountId(tx.params.user) === false) throw 'user';
    if (utils.isValidAccountId(tx.splitFeePayerAddress) === false) throw 'splitFeePayerAddress';
    if (utils.isValidSignatureFormat(tx.params.proxySignature) === false) throw 'proxy signature format';
  } catch (errParam) {
    throw new Error(`Invalid transaction data: ${errParam}`);
  }
}
async function signPaymentInfo(payer, encodedParams) {
  // TODO: Sign using `payers's private keys
  return ''
}
