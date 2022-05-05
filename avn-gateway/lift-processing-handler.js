const utils = require('/opt/utils.js');
const AVN_CONNECTOR_ENDPOINT = process.env.AVN_CONNECTOR_ENDPOINT;

exports.handler = async _event => {
  console.info('Checking for lifts to process');
  try {
    await processLifts();
  } catch (err) {
    await utils.errorResponse('internal', 'failed to connect to queue', err, '', null);
  }
};

async function processLifts() {
  let lifts = (await utils.axios.get(AVN_CONNECTOR_ENDPOINT + 'processLifts')).data;

  if (!lifts || lifts.length === 0) {
    console.info('No lifts to process');
    return;
  }

  console.info('Processing lifts:', lifts.join(', '));
}
