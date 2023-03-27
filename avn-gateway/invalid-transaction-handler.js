const utils = require('/opt/utils.js');

const AVN_CONNECTOR_ENDPOINT = process.env.AVN_CONNECTOR_ENDPOINT;

exports.handler = async (event) => {
  let processedMessagesCount = 0;
  let failedMessages = [];

  try {

    if (!event.Records) {
      console.log(`No messages to process.`);
      return {
        statusCode: 200,
        body: `No messages to process`
      };
    }

    console.log(`Processing ${event.Records.length} message(s) from dead letter queue`);

    for (let record of event.Records) {
      const result = await processFailedMessage(record.body);

      if (utils.requestFailed(result) === true) {
        failedMessages.push(record)
      } else {
        processedMessagesCount += 1;
      }
    }

    if (processedMessagesCount < event.Records.length) {
      console.warn(`Processed ${processedMessagesCount} out of ${event.Records.length} message(s) successfully.`);
      return {
        batchItemFailures: failedMessages
      };
    }

    return {
      statusCode: 200,
      body: `${event.Records.length} message(s) processed successfully.`
    };

  } catch (err) {
    console.error(`Failed to process messages from dead letter queue: `, err);

    return {
      batchItemFailures: failedMessages
    };
  }
};

async function processFailedMessage(message) {
  let tx;
  let requestId;

  console.debug('Failed message: ', message);

  try {
    tx = JSON.parse(message);
    requestId = tx.awsRequestId;
  } catch (err) {
    console.error(`Failed to parse message as JSON: `, err);
    throw err;
  }

  console.info('CALLID_TO_REQUESTID:', tx.id + ' : ' + requestId);

  try {
    await utils.axios.post(AVN_CONNECTOR_ENDPOINT + 'setTransactionFailedToBeSentStatus', { requestId: requestId });
  } catch (err) {
    const errorMessage = `Failed to set status of requestId ${requestId} as 'SendingFailed':${err.toString()}`;
    console.error(errorMessage);

    return {
      error: errorMessage
    }
  }
}
