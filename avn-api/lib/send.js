'use strict';

const common = require('./common.js');
const proxyApi = require('./proxy.js');

const MAX_TX_PROCESSING_TIME = 3000;

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

Send.prototype.postRequest = async function(api, method, params, isRetry) {
  const endpoint = api.gateway + '/send';
  const response =
    (await api.axios().post(endpoint, {jsonrpc: '2.0', id: api.nextId(), method: method, params: params})).data;

  if (response.result) {
    return response.result;
  } else if (isRetry === undefined) {
    await common.sleep(MAX_TX_PROCESSING_TIME);
    return await this.postRequest(api, method, params, true);
  } else {
    await common.sleep(MAX_TX_PROCESSING_TIME);
    return response.error.message;
  }
}

Send.prototype.smartNonce = async function(queryApi, _account) {
  const account = common.convertToPublicKeyIfNeeded(_account);
  const nonceData = this.nonceMap[account];
  const updated = Date.now();

  const nonce = (nonceData === undefined || updated - nonceData.updated >= MAX_TX_PROCESSING_TIME * 2) ?
      parseInt(await queryApi.getAccountNonce(account)) : nonceData.nonce + 1;

  this.nonceMap[account] = {nonce: nonce, updated: updated}
  return nonce.toString();
}

module.exports = Send;
