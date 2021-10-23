const config = require('multiconfig').load();
const AWS = require('aws-sdk');
const log = require('log4js').configure(config.log4Js).getLogger();

const params = {
  FunctionName: 'tx-status-update-handler'
};

async function resolvePendingTransactionsState() {
  // You shouldn't hard-code your keys in production!
  // http://docs.aws.amazon.com/AWSJavaScriptSDK/guide/node-configuring.html
  // AWS.config.update({
  //   accessKeyId: 'AWSAccessKeyId',
  //   secretAccessKey: 'AWSAccessKeySecret',
  //   region: 'eu-west-1',
  // });

  AWS.config.getCredentials(function(err) {
    if (err) log.error(err.stack);
    // credentials not loaded
    else {
      log.info(`Access key: ${AWS.config.credentials.accessKeyId}, Region: ${AWS.config.region}`);
    }
  });

  new AWS.Lambda().invoke(params).promise();
};

module.exports = {
  resolvePendingTransactionsState
}