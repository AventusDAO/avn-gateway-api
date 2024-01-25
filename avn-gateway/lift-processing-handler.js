const utils = require('/opt/utils.js');
const sqs = require('/opt/sqsUtils.js');

const AVN_CONNECTOR_ENDPOINT = process.env.AVN_CONNECTOR_ENDPOINT;
const SQS_TX_QUEUE_URL = process.env.SQS_TX_QUEUE_URL;

exports.handler = async (_event, context) => {
  try {
    await processLifts(context.awsRequestId);
  } catch (error) {
    return console.error(`CHECKING FOR LIFTS TO PROCESS: ${error}`);
  }
};

async function processLifts(requestId) {
  let { fromBlock, toBlock, unprocessedLifts } = (await utils.axios.get(AVN_CONNECTOR_ENDPOINT + 'unprocessedLifts')).data;
  if (!unprocessedLifts || unprocessedLifts.length === 0) {
    console.info(`Checked Ethereum blocks ${fromBlock} to ${toBlock} - no lifts to process`);
  } else {
    console.info(`Checked Ethereum blocks ${fromBlock} to ${toBlock} - found lifts to process: ${unprocessedLifts.join(', ')}`);
    const tx = { txType: 'avnProcessLifts', requestId, toBlock, unprocessedLifts };
    await sqs.sendToQueue(SQS_TX_QUEUE_URL, tx);
  }
}
