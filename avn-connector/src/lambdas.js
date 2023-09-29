const config = require('multiconfig').load();
const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');
const log = require('log4js').configure(config.log4Js).getLogger();

const lambdaFunctionName = config.lambdas.statusLambdaName;
const lambdaFunctionRegion = config.lambdas.statusLambdaRegion;

async function resolvePendingTransactionsState() {
  log.trace(`Invoking ${lambdaFunctionName} lambda`);

  const client = new LambdaClient({ region: lambdaFunctionRegion });
  const command = new InvokeCommand({
    FunctionName: lambdaFunctionName
  });

  client.send(command);
}

module.exports = {
  resolvePendingTransactionsState
};
