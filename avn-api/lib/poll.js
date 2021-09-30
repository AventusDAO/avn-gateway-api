const axios = require('axios');

function Poll(gateway, nextId) {
  this.requestState = Poll.requestState(gateway, nextId);
};

Poll.requestState = function (gateway, nextId) {
  return async function(requestId) {
    return await this.postRequest(gateway, nextId, 'requestState', [requestId]);
  }
};

Poll.prototype.postRequest = async function (gateway, nextId, method, params) {
  const response = (await axios.post(gateway+'/poll', {jsonrpc: '2.0', id: nextId(), method: method, params: params})).data;
  return response.result || response.error.message;
}

module.exports = Poll;
