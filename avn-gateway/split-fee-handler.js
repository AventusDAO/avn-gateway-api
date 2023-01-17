// TODO:
//    Read messages from the PAYER queue
//    Do some basic validation
//    Generate payment info
//    Write the message to the DEFAULT queue

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
  let call;
  let requestId;

  try {
    call = JSON.parse(request);
    requestId = call.awsRequestId;
  } catch (err) {
    console.error(`Failed to parse message as JSON: `, err);
    throw err;
  }

  // TODO: validate call
  console.info('CALLID_TO_REQUESTID:', call.id + ' : ' + requestId);

  const paymentParams = await fees.getSplitFeePaymentParams(AVN_CONNECTOR_ENDPOINT, call);
  const encodedPaymentParams = fees.encodePaymentParams(paymentParams);

  const paymentSignature = await signPaymentInfo(call.splitFeePayerAddress, encodedPaymentParams);

  const paymentInfo = fees.getPaymentInfo(
    call.splitFeePayerAddress,
    call.params.relayer,
    call.params.relayerFee,
    paymentSignature
  )

  call.params.feePaymentSignature = paymentSignature;
  call.params.paymentNonce = paymentParams.paymentNonce;

  console.log("Updated call to store in default queue: ", JSON.stringify(call))

  return utils.buildValidResponseBody(call.id, requestId);
}

async function signPaymentInfo(payer, encodedParams) {
  // TODO: Sign using `payers's private keys
  return ''
}