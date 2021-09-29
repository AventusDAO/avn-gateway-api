const axios = require('axios');

function Send(gateway, nextId) {
  this.endpoint = gateway + '/send';
  this.nextId = nextId;
  this.transferAvt = Send.transferAvt;
};

Send.transferAvt = async function (account, amount) {
  return await this.postRequest('transferAvt', [account, amount]);
};

Send.prototype.postRequest = async function (method, params) {
  const response = (await axios.post(this.endpoint, {jsonrpc: '2.0', id: this.nextId(), method: method, params: params})).data;
  return response.result || response.error.message;
}

module.exports = Send;
