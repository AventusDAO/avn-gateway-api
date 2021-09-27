const axios = require('axios');

const Poll = function Poll(gateway) {
  Poll.endpoint = gateway + '/poll';
  this.id = 1;
  this.requestState = Poll.requestState;
};

Poll.requestState = async function (requestId) {
  return await postRequest({jsonrpc: '2.0', id: this.id++, requestId: requestId});
};

async function postRequest(request) {
  const response = (await axios.post(Poll.endpoint, request)).data;
  return response.result || response.error.message;
}

module.exports = Poll;
