const axios = require('axios');

function Send(api) {
  this.transferAvt = Send.transferAvt(api);
};

Send.transferAvt = function (api) {
  return async function (account, amount) {
    return await this.postRequest(api, 'transferAvt', [account, amount]);
  }
};

Send.prototype.postRequest = async function (api, method, params) {
  const endpoint = api.gateway + '/send';
  const response = (await axios.post(endpoint, {jsonrpc: '2.0', id: api.nextId(), method: method, params: params})).data;
  return response.result || response.error.message;
}

module.exports = Send;
