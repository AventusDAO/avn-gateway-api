const utils = require('/opt/utils.js');
const MQSender = require('/opt/mqSender.js');
const AVN_CONNECTOR_ENDPOINT = process.env.AVN_CONNECTOR_ENDPOINT;
const QUEUE = process.env.MQ_AVN_TX_QUEUE;

let mqSender;

exports.handler = async (_event, context) => {
  try {
    await connectToMQ();
  } catch (error) {
    return console.error(`CONNECTING TO QUEUE: ${error}`);
  }

  try {
    await processLifts(context.awsRequestId);
  } catch (error) {
    return console.error(`CHECKING FOR LIFTS TO PROCESS: ${error}`);
  }
};

const connectToMQ = async () => {
  if (!mqSender || !mqSender.amqpConnection || !mqSender.amqpConnected) {
    mqSender = new MQSender(process.env.SECRET_MANAGER_REGION, process.env.MQ_SECRET_ARN, process.env.MQ_BROKER_AMQP_ENDPOINT);
    await mqSender.connectToMessageBroker();
  }
};

async function processLifts(requestId) {
  let { fromBlock, toBlock, unprocessedLifts } = (await utils.axios.get(AVN_CONNECTOR_ENDPOINT + 'unprocessedLifts')).data;

  if (!unprocessedLifts || unprocessedLifts.length === 0) {
    return console.info(`Checked blocks ${fromBlock} to ${toBlock} - no lifts to process`);
  }

  console.info(`Checked blocks ${fromBlock} to ${toBlock} - found lifts to process: ${unprocessedLifts.join(', ')}`);
  await mqSender.sendMessageToMQ(QUEUE, { txType: 'avnProcessLifts', requestId, toBlock, unprocessedLifts });
}
