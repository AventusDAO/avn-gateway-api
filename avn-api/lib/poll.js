const axios = require('axios');

function Poll(gateway, nextId) {
  this.endpoint = gateway + '/poll';
  this.nextId = nextId;
  this.requestState = Poll.requestState;
};

Poll.requestState = async function (requestId) {
  return await this.postRequest('requestState', [requestId]);
};

Poll.prototype.postRequest = async function (method, params) {
  const response = (await axios.post(this.endpoint, {jsonrpc: '2.0', id: this.nextId(), method: method, params: params})).data;
  return response.result || response.error.message;
}

module.exports = Poll;
