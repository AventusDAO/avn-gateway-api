const config = require('multiconfig').load();
const AWS = require('aws-sdk');
const log = require('log4js').configure(config.log4Js).getLogger();

async function resolvePendingTransactionsState() {
  log.trace(`Invoking status update handler lambda`)
  new AWS.Lambda().invoke({
    FunctionName: 'tx-status-update-handler'
  }).promise();
};

module.exports = {
  resolvePendingTransactionsState
}