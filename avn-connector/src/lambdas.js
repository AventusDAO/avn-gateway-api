const config = require('multiconfig').load();
const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');
const log = require('log4js').configure(config.log4Js).getLogger();

const lambdaFunctionName = config.lambdas.statusLambdaName;

async function resolvePendingTransactionsState() {
  log.trace(`Invoking status-update-handler lambda`);

  const client = new LambdaClient({ region: 'eu-west-1' });
  const command = new InvokeCommand({
    FunctionName: lambdaFunctionName
  });

  client.send(command);
}

module.exports = {
  resolvePendingTransactionsState
};
