const { axios } = require('/opt/utils.js');

exports.handler = async event => {
  for (const record of event.Records) {
    const { endpoint, eventData: data } = JSON.parse(record.body); // eventData: { timestamp, event, publicKey, requestId, data };
    const id = record.messageId;

    try {
      const freshness = new Date().toISOString();

      const headers = {
        'content-type': 'application/json',
        'x-avn-event-id': id,
        'x-avn-event-freshness': freshness
      };

      await axios.post(endpoint, data, { headers });
      console.log(`Event ${id} sent to ${endpoint}: ${JSON.stringify(data)}`);
    } catch (error) {
      console.error(`Failed sending event ${id} to ${endpoint}: ${error.response ? error.response.statusText : error.message}`);
      throw error;
    }
  }
};