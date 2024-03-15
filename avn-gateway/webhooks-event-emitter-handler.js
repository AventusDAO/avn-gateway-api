const { axios } = require('/opt/utils.js');
const { signMessage } = require('/opt/kmsUtils.js');

const KMS_KEY_ID = process.env.WEBHOOKS_SIGNER_KMS_KEY_ID;

exports.handler = async event => {
  for (const record of event.Records) {
    const { endpoint, eventData } = JSON.parse(record.body);
    const eventId = record.messageId;

    try {
      const messageData = { eventId, eventData };
      const signature = await signMessage(KMS_KEY_ID, JSON.stringify(messageData));
      const headers = {
        'Content-Type': 'application/json',
        'X-AVN-Event-ID': eventId,
        'X-AVN-Event-Signature': signature
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
