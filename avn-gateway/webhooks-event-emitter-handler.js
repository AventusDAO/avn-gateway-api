const { axios, callWithTimeout, ONE_SECOND } = require('/opt/utils.js');
const { signMessage } = require('/opt/kmsUtils.js');
const { removeFromQueue } = require('/opt/sqsUtils.js');

const SQS_WEBHOOKS_QUEUE_URL = process.env.SQS_WEBHOOKS_QUEUE_URL;
const KMS_KEY_ID = process.env.WEBHOOKS_SIGNER_KMS_KEY_ID;

exports.handler = async (event, context) => {
  const processedEvents = [];

  for (const record of event.Records) {
    try {
      const timeoutMs = context.getRemainingTimeInMillis() - ONE_SECOND;
      if (timeoutMs > 0) {
        const receipt = await callWithTimeout(timeoutMs, emitEvent, [record]);
        processedEvents.push(receipt);
      } else {
        throw new Error('Lambda execution exceeded allowed time');
      }
    } catch (error) {
      await acknowledgeProcessedEvents(processedEvents);
      throw error;
    }
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

async function acknowledgeProcessedEvents(processedEvents) {
  if (processedEvents.length === 0) return;
  const result = await removeFromQueue(SQS_WEBHOOKS_QUEUE_URL, processedEvents);
  console.log(`Acknowledged processed events: ${JSON.stringify(result, null, 2)}`);
}
