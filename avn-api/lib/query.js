const axios = require('axios');

function Query(gateway, nextId) {
  this.endpoint = gateway + '/query';
  this.nextId = nextId;
  this.getTotalAvt = Query.getTotalAvt;
  this.getAvtBalance = Query.getAvtBalance;
  this.getTokenBalance = Query.getTokenBalance;
  this.getAccountNonce = Query.getAccountNonce;
};

Query.getTotalAvt = async function () {
  return await this.postRequest('getTotalAvt', []);
};

Query.getAvtBalance = async function (account) {
  return await this.postRequest('getAvtBalance', [account]);
};

Query.getTokenBalance = async function (account, token) {
  return await this.postRequest('getTokenBalance', [account, token]);
};

Query.getAccountNonce = async function (account) {
  return await this.postRequest('getAccountNonce', [account]);
};

Query.prototype.postRequest = async function (method, params) {
  const response = (await axios.post(this.endpoint, {jsonrpc: '2.0', id: this.nextId(), method: method, params: params})).data;
  return response.result || response.error.message;
}

module.exports = Query;
