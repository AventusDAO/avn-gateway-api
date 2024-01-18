const axios = require('axios');
const log4js = require('log4js');
const log = log4js.getLogger();

async function post(url, data, token) {
  const tokenReq = typeof token === 'undefined';
  const headers = { 'Content-Type': 'application/json' };

  if (!tokenReq) {
    headers['X-Vault-Request'] = 'true';
    headers['X-Vault-Token'] = token;
  }

  try {
    const res = await axios({ method: 'post', url: url, data: data, headers: headers });
    return tokenReq ? res.data.auth.client_token : res.data.data;
  } catch (err) {
    if (err.response) throw new Error('vault - ' + err.response.data.errors.toString());
    else throw new Error('vault - cannot connect to ' + url);
  }
}

async function get(url, token) {
  const headers = { 'X-Vault-Token': token };

  try {
    return (await axios({ method: 'get', url: url, headers: headers })).data.data;
  } catch (err) {
    log.trace(`vault error on GET: `, err);
    if (err.response) {
      if (err.response.status === 404 || err.response.data.errors[0].includes('Error reading user')) return '';
      else throw new Error('vault - ' + err.response.data.errors.toString());
    } else throw new Error('vault - cannot connect to ' + url);
  }
}

async function appLogin(baseURL, roleId, secretId) {
  const url = baseURL + 'auth/approle/login';
  const data = { role_id: roleId, secret_id: secretId };
  const token = await post(url, data);

  return token;
}

module.exports = function (baseURL, roleId, secretId) {
  this.loginToken = {};
  this.baseURL = baseURL;
  const ROLE_ID = roleId;
  const SECRET_ID = secretId;
  const EXPIRY = 1000 * 60 * 10; //10 min

  this.getToken = async function () {
    const now = Date.now();
    if (!this.loginToken.token || this.loginToken.validUntil < now) {
      log.trace(`token ${this.loginToken.token} has expired on ${this.loginToken.validUntil}. Refreshing...`);
      const token = await appLogin(this.baseURL, ROLE_ID, SECRET_ID);
      this.loginToken.token = token;
      this.loginToken.validUntil = now + EXPIRY;
    }

    return this.loginToken.token;
  };

  this.createNewRelayer = async function (userName) {
    const token = await this.getToken();
    const userUrl = this.baseURL + 'avn-vault/user/' + userName;
    const res = await get(userUrl, token);
    if (res === '') {
      return (await post(userUrl, { name: userName }, token)).publicKey;
    } else return res.publicKey;
  };

  this.setNewRelayer = async function (userName, seed) {
    const token = await this.getToken();
    const userUrl = this.baseURL + 'avn-vault/user/set/' + userName;
    const res = await get(userUrl, token);
    if (res === '') {
      data = { name: userName, seed: seed };
      return (await post(userUrl, data, token)).publicKey;
    } else return res.publicKey;
  };

  this.getRelayerSeed = async function (userName) {
    const token = await this.getToken();
    const url = this.baseURL + 'avn-vault/user/' + userName;
    const relayer = await get(url, token);
    log.info(`Vault relayer data: `, relayer)
    log.info(`Vault relayer seed: `, relayer.seed)
    return relayer.seed;
  };

  this.payerSign = async function (message, username) {
    const token = await this.getToken();
    const res = await get(this.baseURL + 'avn-vault/user/' + username, token);
    if (res === '') {
      throw new Error(`User ${username} does not exist in vault`);
    }

    const url = this.baseURL + 'avn-vault/user/' + username + '/sign';
    const data = { name: username, message: message };
    return await post(url, data, token);
  };
};
