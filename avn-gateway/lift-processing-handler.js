const utils = require('/opt/utils.js');
const sqs = require('/opt/sqsUtils.js');
const sqsClient = new sqs.SQSClient({ region: process.env.AWS_REGION });
const AVN_TX_SQS_URL = process.env.SQS_AVN_TX_QUEUE_URL;
const AVN_CONNECTOR_ENDPOINT = process.env.AVN_CONNECTOR_ENDPOINT;

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
    await sendMessageToTxQueue({ txType: 'avnProcessLifts', requestId, toBlock, unprocessedLifts });
  }
}

async function sendMessageToTxQueue(tx) {
  const messageBody = JSON.stringify(tx);

  const params = {
    QueueUrl: AVN_TX_SQS_URL,
    MessageGroupId: 'AVN_TX',
    MessageDeduplicationId: utils.hashString(messageBody),
    MessageBody: messageBody
  };

  return await sqsClient.send(new sqs.SendMessageCommand(params));
}