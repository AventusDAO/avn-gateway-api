const axios = require('axios');

const Query = function Query(gateway) {
  Query.gateway = gateway;
  this.gateway = Query.gateway;
  this.id = 1;
  this.getTotalAvt = Query.getTotalAvt;
  this.getAvtBalance = Query.getAvtBalance;
  this.getTokenBalance = Query.getTokenBalance;
  this.getAccountNonce = Query.getAccountNonce;
};

Query.gateway;

Query.getTotalAvt = async function () {
  return await postRequest({jsonrpc: '2.0', id: this.id++, method: 'getTotalAvt', params: []});
};

Query.getAvtBalance = async function (account) {
  return await postRequest({jsonrpc: '2.0', id: this.id++, method: 'getAvtBalance', params: [account]});
};

Query.getTokenBalance = async function (account, token) {
  return await postRequest({jsonrpc: '2.0', id: this.id++, method: 'getTokenBalance', params: [account, token]});
};

Query.getAccountNonce = async function (account) {
  return await postRequest({jsonrpc: '2.0', id: this.id++, method: 'getAccountNonce', params: [account]});
};

async function postRequest(request) {
  const response = (await axios.post(Query.gateway, request)).data;
  return response.result || response.error.message;
}

module.exports = Query;
