const { axios, callWithTimeout } = require('/opt/utils.js');
const { signMessage } = require('/opt/kmsUtils.js');
const { getFailedMessagesForFifoQueue } = require('/opt/sqsUtils.js');

const KMS_KEY_ID = process.env.WEBHOOKS_SIGNER_KMS_KEY_ID;

exports.handler = async (event, context) => {
  let acknowledgedEvents = 0;

  try {
    for (const record of event.Records) {
      await callWithTimeout(context.getRemainingTimeInMillis(), processRecordAndEmitEvent, [record]);
      acknowledgedEvents++;
    }
  } catch (error) {
    console.error('Error emitting events', error);
    if (acknowledgedEvents === 0) throw error;
    else return { batchItemFailures: getFailedMessagesForFifoQueue(event.Records, acknowledgedEvents) };
  }
};

async function processRecordAndEmitEvent(record) {
  const event = await processRecord(record);
  await emitEvent(event);
}

async function processRecord(record) {
  try {
    const id = record.messageId;
    const { endpoint, eventData: data } = JSON.parse(record.body);
    const freshness = new Date().toISOString();
    const message = JSON.stringify({ id, freshness, data });
    const signature = await signMessage(KMS_KEY_ID, message);
    return { id, freshness, signature, endpoint, data };
  } catch (error) {
    throw new Error(`Error processing record: ${error.message}`);
  }
}

async function emitEvent(event) {
  const { id, freshness, signature, endpoint, data } = event;
  const headers = {
    'content-type': 'application/json',
    'x-avn-event-id': id,
    'x-avn-event-freshness': freshness,
    'x-avn-event-signature': signature
  };

  try {
    await axios.post(endpoint, data, { headers });
  } catch (error) {
    throw new Error(`Error emitting event ${id} for ${endpoint} ${error.response ? error.response.statusText : error.message}`);
  }
}
