const axios = require('axios');

function Poll(api) {
  this.requestState = Poll.requestState(api);
};

Poll.requestState = function (api) {
  return async function(requestId) {
    return await this.postRequest(api, 'requestState', [requestId]);
  }
};

Poll.prototype.postRequest = async function (api, method, params) {
  const endpoint = api.gateway + '/poll';
  const response = (await axios.post(endpoint, {jsonrpc: '2.0', id: api.nextId(), method: method, params: params})).data;
  return response.result || response.error.message;
}

module.exports = Poll;
