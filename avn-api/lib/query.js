const axios = require('axios');

const Query = function Query(gateway) {
  this.gateway = gateway;
  this.id = 1;
  this.getTotalAvt = Query.getTotalAvt;
  this.getAvtBalance = Query.getAvtBalance;
  this.getTokenBalance = Query.getTokenBalance;
  this.getAccountNonce = Query.getAccountNonce;
};

Query.getTotalAvt = async function () {
  return await postRequest(this.gateway, {jsonrpc: '2.0', id: this.id++, method: 'getTotalAvt', params: []});
};

Query.getAvtBalance = async function (account) {
  return await postRequest(this.gateway, {jsonrpc: '2.0', id: this.id++, method: 'getAvtBalance', params: [account]});
};

Query.getTokenBalance = async function (account, token) {
  return await postRequest(this.gateway, {jsonrpc: '2.0', id: this.id++, method: 'getTokenBalance', params: [account, token]});
};

Query.getAccountNonce = async function (account) {
  return await postRequest(this.gateway, {jsonrpc: '2.0', id: this.id++, method: 'getAccountNonce', params: [account]});
};


async function postRequest(gateway, request) {
  const response = (await axios.post(gateway, request)).data;
  return response.result || response.error.message;
}

module.exports = Query;
