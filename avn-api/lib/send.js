const axios = require('axios');
const proxyApi = require('./proxy.js');

function Send(api) {
  this.transferAvt = generateFunction(transferAvt, api);
  this.transferToken = generateFunction(transferToken, api);
};

function transferAvt(api) {
  return async function(account, amount) {
    return await this.postRequest(api, 'transferAvt', [account, amount.toString()]);
  }
};

function transferToken(api) {
  return async function (relayer, nonce, from, to, token, amount) {
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

function generateFunction(functionName, api) {
  return functionName(api);
}

Send.prototype.postRequest = async function(api, method, params) {
  const endpoint = api.gateway + '/send';
  const response =
    (await axios.post(endpoint, {jsonrpc: '2.0', id: api.nextId(), method: method, params: params})).data;
  return response.result || response.error.message;
}

module.exports = Send;
