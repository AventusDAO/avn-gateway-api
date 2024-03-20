const { axios } = require('/opt/utils.js');
const { signMessage } = require('/opt/kmsUtils.js');
const { deleteMessagesFromQueue } = require('/opt/sqsUtils.js');

const SQS_WEBHOOKS_QUEUE_URL = process.env.SQS_WEBHOOKS_QUEUE_URL;
const KMS_KEY_ID = process.env.WEBHOOKS_SIGNER_KMS_KEY_ID;

exports.handler = async (event, context) => {
  const sentMessages = [];

  for (const record of event.Records) {
    if (context.getRemainingTimeInMillis() < utils.ONE_SECOND) {
      throw new Error('Execution time limit reached');
    }

    const { endpoint, eventData: data } = JSON.parse(record.body);
    const id = record.messageId;

    try {
      const freshness = new Date().toISOString();
      const message = JSON.stringify({ id, freshness, data });
      const signature = await signMessage(KMS_KEY_ID, message);

      const headers = {
        'content-type': 'application/json',
        'x-avn-event-id': id,
        'x-avn-event-signature': signature,
        'x-avn-event-freshness': freshness
      };

      await axios.post(endpoint, data, { headers });
      console.log(`Event ${id} sent to ${endpoint}: ${JSON.stringify(data)}`);
      sentMessages.push({ Id: id, ReceiptHandle: record.receiptHandle });
    } catch (error) {
      console.error(`Failed sending event ${id} to ${endpoint}: ${error.response ? error.response.statusText : error.message}`);
      if (sentMessages.length > 0) {
        await deleteMessagesFromQueue(SQS_WEBHOOKS_QUEUE_URL, sentMessages);
      }
      throw error;
    }
  }
};
