const utils = require('/opt/utils.js');
const MQSender = require('/opt/mqSender.js');
const AVN_CONNECTOR_ENDPOINT = process.env.AVN_CONNECTOR_ENDPOINT;
const QUEUE = process.env.MQ_AVN_TX_QUEUE;

let mqSender;

exports.handler = async _event => {
  try {
    await connectToMQ();
  } catch (err) {
    console.error(err);
  }

  console.info('Checking for lifts to process');
  try {
    await processLifts();
  } catch (err) {
    console.error(err);
  }
};

const connectToMQ = async () => {
  if (!mqSender || !mqSender.amqpConnection || !mqSender.amqpConnected) {
    mqSender = new MQSender(process.env.SECRET_MANAGER_REGION, process.env.MQ_SECRET_ARN, process.env.MQ_BROKER_AMQP_ENDPOINT);
    await mqSender.connectToMessageBroker();
  }
};

async function processLifts() {
  let unprocessedLifts = (await utils.axios.get(AVN_CONNECTOR_ENDPOINT + 'unprocessedLifts')).data;

  if (!unprocessedLifts || unprocessedLifts.length === 0) {
    console.info('No lifts to process');
    return;
  }

  console.info('Processing lifts:', unprocessedLifts.join(', '));
  await mqSender.sendMessageToMQ(QUEUE, { txType: 'avnProcessLifts', unprocessedLifts });
}
