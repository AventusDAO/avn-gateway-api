'use strict';

const proxyApi = require('./proxy.js');

function Send(api, queryApi) {
  this.transferAvt = generateFunction(transferAvt, api);
  this.transferToken = generateFunction(transferToken, api, queryApi);
}

function transferAvt(api) {
  return async function(account, amount) {
    return await this.postRequest(api, 'transferAvt', [account, amount.toString()]);
  }
}

function transferToken(api, queryApi) {
  console.log("query Api", queryApi);

  return async function (relayer, from, to, token, amount) {
    let nonce = await queryApi.getAccountNonce(from);
    let signature = proxyApi.transferToken.createAuthorisationSignature(relayer, from, to, token, amount, nonce);

    return await this.postRequest(api, 'proxy',
      {
        pallet: 'tokenManager',
        method: 'signedTransfer',
        signature,
        relayer,
        innerArgs: { from, to, token, amount }
      });
  };
}

function generateFunction(functionName, api, queryApi) {
  return functionName(api, queryApi);
}

Send.prototype.postRequest = async function(api, method, params) {
  const endpoint = api.gateway + '/send';
  const response =
    (await api.axios().post(endpoint, {jsonrpc: '2.0', id: api.nextId(), method: method, params: params})).data;
  return response.result || response.error.message;
}

module.exports = Send;
