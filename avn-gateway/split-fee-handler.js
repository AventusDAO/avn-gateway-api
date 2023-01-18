const utils = require('/opt/utils.js');
const sqs = require('/opt/sqsUtils.js');

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

  // TODO: implement me

  return utils.buildValidResponseBody(tx.id, requestId);
}