const axios = require('axios');
const QUERY_SERVER = 'http://ec2-35-178-74-219.eu-west-2.compute.amazonaws.com:3000/avnQuery';

exports.handler = async (event) => {
  const response = {
    statusCode: 200,
    body: JSON.stringify(await makeCall(event.body))
  };
  return response;
};

async function makeCall(body) {
  const call = JSON.parse(body);
  let response, result, token, account;

  switch (call.method) {
    case 'getTotalAvt':
      response = await axios.post(QUERY_SERVER, {palletName:'balances', storageName:'totalIssuance', params:[]});
      result = BigInt(response.data).toString();
      break;
    case 'getAvtBalance':
      account = call.params[0];
      response = await axios.post(QUERY_SERVER, {palletName:'system', storageName:'account', params:[account]});
      result = BigInt(response.data.data.free).toString();
      break;
    case 'getTokenBalance':
      account = call.params[0];
      token = call.params[1];
      response = await axios.post(QUERY_SERVER, {palletName:'tokenManager', storageName:'balances', params:[[token, account]]});
      result = BigInt(response.data).toString();
      break;
    case 'getAccountNonce':
      account = call.params[0];
      response = await axios.post(QUERY_SERVER, {palletName:'tokenManager', storageName:'nonces', params:[account]});
      result = response.data.toString();
      break;
    default:
      result = {data: 0};
  }

  return {jsonrpc: '2.0', id: call.id, result: result};
}

// async function testlocal() {
//   console.log('getTotalAvt:', await makeCall('{"jsonrpc": "2.0", "method":"getTotalAvt", "params":[], "id":1}'));
//   console.log('getAvtBalance:', await makeCall('{"jsonrpc":"2.0", "method":"getAvtBalance", "params":["5GLVUNb9oKLesAjDt17X1N49xyp2fr62sKPAKLgmmNbDB9MH"], "id":2}'));
//   console.log('getTokenBalance:', await makeCall('{"jsonrpc":"2.0", "method":"getTokenBalance", "params": ["5DAgxVxKmnJ7hfhDEB9UetZm4jR2MPjGZGrmJZjirSVJDdMr", "0x2adce7ada36d86253aa63bcf4aad9f84ccb9480e"], "id":3}'));
//   console.log('getAccountNonce:', await makeCall('{"jsonrpc":"2.0", "method":"getAccountNonce", "params":["5GLVUNb9oKLesAjDt17X1N49xyp2fr62sKPAKLgmmNbDB9MH"], "id":4}'));
// }
//
// testlocal();