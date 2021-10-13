'use strict';

const common = require('./common.js');
const proxyApi = require('./proxy.js');

const SMART_NONCE_WINDOW = 5000;

function Send(api, queryApi) {
  this.transferAvt = generateFunction(transferAvt, api);
  this.transferToken = generateFunction(transferToken, api, queryApi);
  this.nonceMap = {};
}

function transferAvt(api) {
  return async function(account, amount) {
    return await this.postRequest(api, 'transferAvt', [account, amount.toString()]);
  }
}

function transferToken(api, queryApi) {
  return async function (relayer, from, to, token, amount) {
    let nonce = await this.smartNonce(queryApi, from);
    let signature = proxyApi.transferToken.createAuthorisationSignature(relayer, from, to, token, amount, nonce);

    return await this.postRequest(api, 'proxy',
      {
        pallet: 'tokenManager',
        method: 'signedTransfer',
        signature,
        relayer,
        innerArgs: {from, to, token, amount}
      }
    );
  };
}

function generateFunction(functionName, api, queryApi) {
  return functionName(api, queryApi);
}

Send.prototype.postRequest = async function(api, method, params) {
  const endpoint = api.gateway + '/send';
  const response =
    (await api.axios().post(endpoint, {jsonrpc: '2.0', id: api.nextId(), method: method, params: params})).data;
  return response.result || this.handleRequestError(response, method, params);
}

Send.prototype.handleRequestError = function(response, method, params) {
  if (method === 'proxy') {
    const account = common.convertToPublicKeyIfNeeded(params.innerArgs.from);
    this.nonceMap[account].nonce -= 1;
    this.nonceMap[account].updated -= SMART_NONCE_WINDOW;
  }
  return response.error.message;
}

Send.prototype.smartNonce = async function(queryApi, from) {
  const account = common.convertToPublicKeyIfNeeded(from);
  const nonceData = this.nonceMap[account];
  const updated = Date.now();

  const nonce = (nonceData === undefined || updated - nonceData.updated >= SMART_NONCE_WINDOW) ?
      parseInt(await queryApi.getAccountNonce(account)) : nonceData.nonce + 1;

  this.nonceMap[account] = {nonce: nonce, updated: updated}
  return nonce.toString();
}

module.exports = Send;
