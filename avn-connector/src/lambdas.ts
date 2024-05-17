const config = require('multiconfig').load();
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import logger from './logger';

const lambdaFunctionName: string = config.lambdas.statusLambdaName;

async function resolvePendingTransactionsState(): Promise<void> {
  logger.info(`Invoking ${lambdaFunctionName} lambda`);

  const client = new LambdaClient({ region: config.aws.region });
  const command = new InvokeCommand({
    FunctionName: lambdaFunctionName,
  });

  try {
    await client.send(command);
  } catch (error) {
    logger.error(`Failed to invoke ${lambdaFunctionName} lambda`, error);
  }
}

const lambda = { resolvePendingTransactionsState };
export default lambda;
