const axios = require('axios');

function Query(api) {
  this.getTotalAvt = Query.getTotalAvt(api);
  this.getAvtBalance = Query.getAvtBalance(api);
  this.getTokenBalance = Query.getTokenBalance(api);
  this.getAccountNonce = Query.getAccountNonce(api);
};

Query.getTotalAvt = function (api) {
  return async function () {
    return await this.postRequest(api, 'getTotalAvt', []);
  }
};

Query.getAvtBalance = function (api) {
  return async function (account) {
    return await this.postRequest(api, 'getAvtBalance', [account]);
  }
};

Query.getTokenBalance = function (api) {
  return async function (account, token) {
    return await this.postRequest(api, 'getTokenBalance', [account, token]);
  }
};

Query.getAccountNonce = function (api) {
  return async function (account) {
    return await this.postRequest(api, 'getAccountNonce', [account]);
  }
};

Query.prototype.postRequest = async function (api, method, params) {
  const endpoint = api.gateway + '/query';
  const response = (await axios.post(endpoint, {jsonrpc: '2.0', id: api.nextId(), method: method, params: params})).data;
  return response.result || response.error.message;
}

module.exports = Query;
