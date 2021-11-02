'use strict'

const AWS = require('aws-sdk');

// TODO: Fix the logger used by the caller:
//   lambda function is using console to log
//   ec2 script is using log4js

module.exports = SecretsManager;

function SecretsManager(region, log) {
  this.smClient = new AWS.SecretsManager({region: region});
  this.log = log;
}

SecretsManager.prototype.getSecret = async function(secretId) {
  let self = this;
  return await new Promise((resolve, reject) => {
    self.smClient.getSecretValue({SecretId: secretId}, function(err, data) {
      if (err) {
        self.log.error('[SECRET MANAGER] get secret value error', err.message);
        throw err;
      } else if ('SecretString' in data) {
        const secret = JSON.parse(data.SecretString);
        resolve(secret);
      }
    });
  })
}