const utils = require('/opt/utils.js');

exports.handler = async event => {
  for (const record of event.Records) {
    const { endpoint, eventData } = JSON.parse(record.body);
    try {
      const headers = { 'Content-Type': 'application/json' };
      const response = await utils.axios.post(endpoint, eventData, headers);
      if (response.status >= 200 && response.status < 300) {
        console.log(`Event sent successfully to ${endpoint}. Event data: ${JSON.stringify(eventData)}`);
      } else {
        console.error(`Failed to send event to ${endpoint}: ${response.statusText}. Event data: ${JSON.stringify(eventData)}`);
      }
    } catch (error) {
      console.error(`Error publishing event to ${endpoint}: ${error.response ? error.response.dta : error.message}`);
    }
  }
};
