const axios = require('axios');

const Poll = function Poll(gateway, id) {
  Poll.endpoint = gateway + '/poll';
  this.id = id;
  this.requestState = Poll.requestState;
};

Poll.requestState = async function (requestId) {
  return await postRequest({jsonrpc: '2.0', id: this.id(), method: 'requestState', params: [requestId]});
};

async function postRequest(request) {
  const response = (await axios.post(Poll.endpoint, request)).data;
  return response.result || response.error.message;
}

module.exports = Poll;
