const config = require('multiconfig').load();
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import log4js from 'log4js';

log4js.configure(config.log4Js);
const log = log4js.getLogger();

const lambdaFunctionName: string = config.lambdas.statusLambdaName;

async function resolvePendingTransactionsState(): Promise<void> {
  log.trace(`Invoking ${lambdaFunctionName} lambda`);

  const client = new LambdaClient({ region: config.aws.region });
  const command = new InvokeCommand({
    FunctionName: lambdaFunctionName,
  });

  try {
    await client.send(command);
  } catch (error) {
    log.error(`Failed to invoke ${lambdaFunctionName} lambda`, error);
  }
}

const lambda = { resolvePendingTransactionsState };
export default lambda;
