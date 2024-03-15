const { axios } = require('/opt/utils.js');
const { signMessage } = require('/opt/kmsUtils.js');

const KMS_KEY_ID = process.env.WEBHOOKS_SIGNER_KMS_KEY_ID;

exports.handler = async event => {
  for (const record of event.Records) {
    const { endpoint, eventData } = JSON.parse(record.body); // eventData: { timestamp, event, publicKey, requestId, data };
    const eventId = record.messageId;

    try {
      const messageData = { eventId, eventData };
      const message = JSON.stringify(messageData);
      const signature = await signMessage(KMS_KEY_ID, message);
      const headers = {
        'content-type': 'application/json',
        'x-avn-event-id': eventId,
        'x-avn-event-signature': signature
      };

      await axios.post(endpoint, eventData, { headers });
      console.log(`Event ID ${eventId} sent to ${endpoint}: ${JSON.stringify(eventData)}`);
    } catch (error) {
      console.error(
        `Error sending event ID ${eventId} to ${endpoint}: ${error.response ? error.response.statusText : error.message}`
      );
    }
  }
};
