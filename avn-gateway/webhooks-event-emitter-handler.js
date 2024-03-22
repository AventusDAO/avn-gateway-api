const { axios, callWithTimeout, ONE_SECOND } = require('/opt/utils.js');
const { signMessage } = require('/opt/kmsUtils.js');
const { getFailedMessagesForFifoQueue } = require('/opt/sqsUtils.js');

const KMS_KEY_ID = process.env.WEBHOOKS_SIGNER_KMS_KEY_ID;

exports.handler = async (event, context) => {
  let acknowledgedEventsCount = 0;

  try {
    for (const record of event.Records) {
      const timeoutMs = context.getRemainingTimeInMillis() - ONE_SECOND;
      if (timeoutMs > 0) {
        await callWithTimeout(timeoutMs, emitEvent, [record]);
        acknowledgedEventsCount++;
      } else {
        throw new Error('Lambda execution exceeded allowed time');
      }
    }
  } catch (error) {
    console.error('Error emitting events', error);
    if (acknowledgedEventsCount === 0) throw error;
    else return { batchItemFailures: getFailedMessagesForFifoQueue(event.Records, acknowledgedEventsCount) };
  }
};

async function emitEvent(record) {
  const { body, messageId: id, receiptHandle } = record;
  const { endpoint, eventData: data } = JSON.parse(body);
  const freshness = new Date().toISOString();
  const message = JSON.stringify({ id, freshness, data });

  try {
    const headers = {
      'content-type': 'application/json',
      'x-avn-event-id': id,
      'x-avn-event-freshness': freshness,
      'x-avn-event-signature': await signMessage(KMS_KEY_ID, message)
    };

    await axios.post(endpoint, data, { headers });
    return { Id: id, ReceiptHandle: receiptHandle };
  } catch (error) {
    throw new Error(`Failed sending event ${id} to ${endpoint}: ${error.response ? error.response.statusText : error.message}`);
  }
}
