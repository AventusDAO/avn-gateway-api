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
  // TODO: Do we want to log out the full content of payload? Eventhough it contains a proxySignature?
  log.trace(`Invoking payout-all-stakers lambda. Era: ${payload.params.era}, sender: ${payload.params.relayer}`);

  const client = new LambdaClient({ region: 'eu-west-1' });
  const command = new InvokeCommand({
    FunctionName: 'stakers-payout-handler',
    Payload: JSON.stringify(payload)
  });

  const result = await client.send(command);

  if (!result || result.StatusCode !== 200) {
    throw new Error(`payout-all-stakers lambda returned an error: `, result);
  }
}

module.exports = {
  payoutAllStakers,
  resolvePendingTransactionsState
};
