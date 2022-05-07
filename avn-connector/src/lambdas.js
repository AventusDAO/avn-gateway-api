const config = require('multiconfig').load();
const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');
const log = require('log4js').configure(config.log4Js).getLogger();

async function resolvePendingTransactionsState() {
  log.trace(`Invoking status-update-handler lambda`);

  const client = new LambdaClient({ region: 'eu-west-1' });
  const command = new InvokeCommand({
    FunctionName: 'tx-status-update-handler'
  });

  client.send(command);
}

async function payoutAllStakers(payload) {
  log.trace(`Invoking send-handler to payout stakers`);

  const client = new LambdaClient({ region: 'eu-west-1' });
  const command = new InvokeCommand({
    FunctionName: 'stakers-payout-handler',
    Payload: JSON.stringify(payload)
  });

  await client.send(command);
}

module.exports = {
  payoutAllStakers,
  resolvePendingTransactionsState
};
