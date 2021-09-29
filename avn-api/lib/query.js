const axios = require('axios');

const Query = function Query(gateway, nextId) {
  Query.endpoint = gateway + '/query';
  Query.nextId = nextId;
  this.getTotalAvt = Query.getTotalAvt;
  this.getAvtBalance = Query.getAvtBalance;
  this.getTokenBalance = Query.getTokenBalance;
  this.getAccountNonce = Query.getAccountNonce;
};

Query.getTotalAvt = async function () {
  return await postRequest({jsonrpc: '2.0', id: Query.nextId(), method: 'getTotalAvt', params: []});
};

Query.getAvtBalance = async function (account) {
  return await postRequest({jsonrpc: '2.0', id: Query.nextId(), method: 'getAvtBalance', params: [account]});
};

Query.getTokenBalance = async function (account, token) {
  return await postRequest({jsonrpc: '2.0', id: Query.nextId(), method: 'getTokenBalance', params: [account, token]});
};

Query.getAccountNonce = async function (account) {
  return await postRequest({jsonrpc: '2.0', id: Query.nextId(), method: 'getAccountNonce', params: [account]});
};

async function postRequest(request) {
  const response = (await axios.post(Query.endpoint, request)).data;
  return response.result || response.error.message;
}

module.exports = Query;
