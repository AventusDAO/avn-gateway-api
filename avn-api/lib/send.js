const axios = require('axios');

function Send(gateway, nextId) {
  this.transferAvt = Send.transferAvt(gateway, nextId);
};

Send.transferAvt = function (gateway, nextId) {
  return async function (account, amount) {
    return await this.postRequest(gateway, nextId, 'transferAvt', [account, amount]);
  }
};

Send.prototype.postRequest = async function (gateway, nextId, method, params) {
  const response = (await axios.post(gateway+'/send', {jsonrpc: '2.0', id: nextId(), method: method, params: params})).data;
  return response.result || response.error.message;
}

module.exports = Send;
