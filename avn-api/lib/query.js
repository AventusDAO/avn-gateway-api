const axios = require('axios');

function Query(gateway, nextId) {
  this.getTotalAvt = Query.getTotalAvt(gateway, nextId);
  this.getAvtBalance = Query.getAvtBalance(gateway, nextId);
  this.getTokenBalance = Query.getTokenBalance(gateway, nextId);
  this.getAccountNonce = Query.getAccountNonce(gateway, nextId);
};

Query.getTotalAvt = function (gateway, nextId) {
  return async function () {
    return await this.postRequest(gateway, nextId, 'getTotalAvt', []);
  }
};

Query.getAvtBalance = function (gateway, nextId) {
  return async function (account) {
    return await this.postRequest(gateway, nextId, 'getAvtBalance', [account]);
  }
};

Query.getTokenBalance = function (gateway, nextId) {
  return async function (account, token) {
    return await this.postRequest(gateway, nextId, 'getTokenBalance', [account, token]);
  }
};

Query.getAccountNonce = function (gateway, nextId) {
  return async function (account) {
    return await this.postRequest(gateway, nextId, 'getAccountNonce', [account]);
  }
};

Query.prototype.postRequest = async function (gateway, nextId, method, params) {
  const response = (await axios.post(gateway+'/query', {jsonrpc: '2.0', id: nextId(), method: method, params: params})).data;
  return response.result || response.error.message;
}

module.exports = Query;
