const utils = require('/opt/utils.js');

exports.handler = async event => {
  for (const record of event.Records) {
    const { endpoint, data } = JSON.parse(record.body);
    try {
      const response = await axios.post(endpoint, data, { headers: { 'Content-Type': 'application/json' } });
      if (response.status >= 200 && response.status < 300) {
        console.log(`Event published successfully to ${endpoint}. Event data: ${JSON.stringify(data)}`);
      } else {
        console.error(`Failed to publish event to ${endpoint}: ${response.statusText}. Event data: ${JSON.stringify(data)}`);
      }
    } catch (error) {
      console.error(`Error publishing event to ${endpoint}: ${error.response ? error.response.data : error.message}`);
    }
  }
};
