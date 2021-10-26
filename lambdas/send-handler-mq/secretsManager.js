'use strict'

const AWS = require('aws-sdk');

module.exports = SecretsManager;

function SecretsManager(region) {
  this.smClient = new AWS.SecretsManager({region: region});
}

SecretsManager.prototype.getSecret = async function(secretId) {
  let self = this;
  return await new Promise((resolve, reject) => {
    self.smClient.getSecretValue({SecretId: secretId}, function(err, data) {
      if (err) {
        console.error('[SECRET MANAGER] get secret value error', err.message);
        reject(err);
      } else if ('SecretString' in data) {
        const secret = JSON.parse(data.SecretString);
        resolve(secret);
      }
    });
  }) 
}