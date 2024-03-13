const utils = require('/opt/utils.js');

exports.handler = async event => {
  for (const record of event.Records) {
    const { endpoint, eventData } = JSON.parse(record.body);
    try {
      const response = await utils.axios.post(endpoint, eventData);
      console.log(`Event sent to ${endpoint}: ${JSON.stringify(eventData)}`);
    } catch (error) {
      console.error(`Error sending event to ${endpoint}: ${error.response ? error.response.statusText : error.message}`);
    }
  }
};
