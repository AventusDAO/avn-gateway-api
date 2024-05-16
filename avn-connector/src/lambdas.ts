const config = require('multiconfig').load();
const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');
const logger = require('./logger');

const lambdaFunctionName = config.lambdas.statusLambdaName;

async function resolvePendingTransactionsState() {
  logger.info(`Invoking ${lambdaFunctionName} lambda`);

  const client = new LambdaClient({ region: config.aws.region });
  const command = new InvokeCommand({
    FunctionName: lambdaFunctionName
  });

  client.send(command);
}

module.exports = {
  resolvePendingTransactionsState
};
