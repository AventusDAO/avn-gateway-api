const axios = require('axios')

async function post(url, data, token) {
  const tokenReq = typeof token === 'undefined'
  const headers = { 'Content-Type': 'application/json' }

  if (!tokenReq) {
    headers['X-Vault-Request'] = 'true'
    headers['X-Vault-Token'] = token
  }

  try {
    const res = await axios({ method: 'post', url: url, data: data, headers: headers })
    return tokenReq ? res.data.auth.client_token : res.data.data
  } catch (err) {
    if (err.response) throw new Error('vault - ' + err.response.data.errors.toString())
    else throw new Error('vault - cannot connect to ' + url)
  }
}

async function get(url, token) {
  const headers = { 'X-Vault-Token': token }

  try {
    return (await axios({ method: 'get', url: url, headers: headers })).data.data
  } catch (err) {
    if (err.response) {
      if (err.response.status == 404 || err.response.data.errors[0].includes('Error reading user')) return ''
      else throw new Error('vault - ' + err.response.data.errors.toString())
    } else throw new Error('vault - cannot connect to ' + url)
  }
}

async function appLogin(baseURL, roleId, secretId) {
  const url = baseURL + 'auth/approle/login'
  const data = { roleId: roleId, secretId: secretId }
  return await post(url, data)
}

module.exports = function(baseURL, roleId, secretId) {
  this.baseURL = baseURL
  const ROLE_ID = roleId
  const SECRET_ID = secretId

  this.createNewRelayer = async function(relayerAddress) {
    const token = await appLogin(this.baseURL, ROLE_ID, SECRET_ID)
    const userUrl = this.baseURL + 'avn-vault/user/' + relayerAddress
    const res = await get(userUrl, token)
    if (res === '') {
      return (await post(userUrl, { name: relayerAddress }, token)).publicKey
    } else return res.publicKey
  }

  this.getRelayerSeed = async function(relayerAddress) {
    const token = await appLogin(this.baseURL, ROLE_ID, SECRET_ID)
    const url = this.baseURL + 'avn-vault/user/' + relayerAddress
    return (await get(url, token)).seed
  }
}
