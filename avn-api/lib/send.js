function Send(api) {
  this.transferAvt = generateFunction(transferAvt, api);
};

function transferAvt(api) {
  return async function(account, amount) {
    return await this.postRequest(api, 'transferAvt', [account, amount.toString()]);
  }
};

function generateFunction(functionName, api) {
  return functionName(api);
}

Send.prototype.postRequest = async function(api, method, params) {
  const endpoint = api.gateway + '/send';
  const response = (await api.axios.post(endpoint, {jsonrpc: '2.0', id: api.nextId(), method: method, params: params})).data;
  return response.result || response.error.message;
}

module.exports = Send;
