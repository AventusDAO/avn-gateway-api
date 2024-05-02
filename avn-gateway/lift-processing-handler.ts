import * as utils from '/opt/utils.js';
import * as sqs from '/opt/sqsUtils.js';
// @ts-ignore
import { Handler, Context } from 'aws-lambda';
import { LiftData, LiftTransaction } from '/opt/handler-types';

const AVN_CONNECTOR_ENDPOINT: string = process.env.AVN_CONNECTOR_ENDPOINT!;
const SQS_TX_QUEUE_URL: string = process.env.SQS_TX_QUEUE_URL!;

export const handler: Handler = async (_event: any, context: Context): Promise<void> => {
  try {
    await processLifts(context.awsRequestId);
  } catch (error) {
    console.error(`CHECKING FOR LIFTS TO PROCESS: ${error}`);
  }
};

async function processLifts(requestId: string): Promise<void> {
  let { fromBlock, toBlock, unprocessedLifts }: LiftData = (await utils.axios.get(`${AVN_CONNECTOR_ENDPOINT}unprocessedLifts`)).data;
  if (!unprocessedLifts || unprocessedLifts.length === 0) {
    console.info(`Checked Ethereum blocks ${fromBlock} to ${toBlock} - no lifts to process`);
  } else {
    console.info(`Checked Ethereum blocks ${fromBlock} to ${toBlock} - found lifts to process: ${unprocessedLifts.join(', ')}`);
    const tx: LiftTransaction = { txType: 'avnProcessLifts', requestId, toBlock, unprocessedLifts };
    await sqs.sendToQueue(SQS_TX_QUEUE_URL, tx);
  }
}
