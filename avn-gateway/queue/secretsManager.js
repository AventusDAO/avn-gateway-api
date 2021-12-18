'use strict'

const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager')

module.exports = SecretsManager

function SecretsManager(region) {
  this.smClient = new SecretsManagerClient({ region: region })
}

SecretsManager.prototype.getSecret = async function (secretId) {
  const params = { SecretId: secretId }
  const command = new GetSecretValueCommand(params)
  try {
    const response = await this.smClient.send(command)
    if ('SecretString' in response) {
      const secret = JSON.parse(response.SecretString)
      return secret
    } else {
      throw Error('SecretString not found in response')
    }
  } catch (error) {
    console.error('[SECRET MANAGER] get secret value error', error.message)
    throw error
  }
}
