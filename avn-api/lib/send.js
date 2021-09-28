const axios = require('axios');

const Send = function Send(gateway, nextId) {
  Send.endpoint = gateway + '/send';
  this.nextId = nextId;
  this.transferAvt = Send.transferAvt;
};

Send.transferAvt = async function (account, amount) {
  return await postRequest({jsonrpc: '2.0', id: this.nextId(), method: 'transferAvt', params: [account, amount]});
};

async function postRequest(request) {
  const response = (await axios.post(Send.endpoint, request)).data;
  return response.result || response.error.message;
}

module.exports = Send;
