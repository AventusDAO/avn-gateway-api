const axios = require('axios');

const Send = function Send(gateway, id) {
  Send.endpoint = gateway + '/send';
  this.id = id;
  this.transferAvt = Send.transferAvt;
};

Send.transferAvt = async function (account, amount) {
  return await postRequest({jsonrpc: '2.0', id: this.id(), method: 'transferAvt', params: [account, amount]});
};

async function postRequest(request) {
  const response = (await axios.post(Send.endpoint, request)).data;
  return response.result || response.error.message;
}

module.exports = Send;
