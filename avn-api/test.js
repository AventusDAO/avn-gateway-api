const AvnApi = require('./index.js')

const user1 = {
  address: '5GLVUNb9oKLesAjDt17X1N49xyp2fr62sKPAKLgmmNbDB9MH',
  publicKey: '0xbcfb2baf67c7553a9fa39d3526f697dcf84165fbef074378ec8d5d68384d7749'
}

const user2 = {
  address: '5DAgxVxKmnJ7hfhDEB9UetZm4jR2MPjGZGrmJZjirSVJDdMr',
  publicKey: '0x30ccad92fa31a27621c5fdf872c0244d92b0211662c5bce869d93edf79120f2e'
}

const token = '0x2adce7ada36d86253aa63bcf4aad9f84ccb9480e';
const BAD_REQUEST = '0x0000000000000000000000000000000000000000000000000000000000000000'

async function main() {
  const api = new AvnApi('https://n67ibi1ujh.execute-api.eu-west-2.amazonaws.com');

  console.log('\n***INFO**');
  console.log('Version:', api.version);
  console.log('Gateway:', api.gateway);

  console.log('\n***QUERIES***');
  console.log('Total AVT:                             ', await api.query.getTotalAvt());
  console.log('User AVT balance by address:           ', await api.query.getAvtBalance(user1.address));
  console.log('User AVT balance by public key:        ', await api.query.getAvtBalance(user2.publicKey));
  console.log('User token balance by address:         ', await api.query.getTokenBalance(user1.address, token));
  console.log('User token balance by public key:      ', await api.query.getTokenBalance(user2.publicKey, token));
  console.log('User account nonce by address:         ', await api.query.getAccountNonce(user1.address));
  console.log('User account nonce by public key:      ', await api.query.getAccountNonce(user2.publicKey));
  console.log('Expect error:                          ', await api.query.getAccountNonce('0000'));

  console.log('\n***TRANSACTIONS***');
  let requestId = await api.send.transferAvt(user2.address, '1');
  console.log('Transfer AVT using recipient address. Returned hash:  ', requestId);

  console.log('\n***POLLING STATE***');
  try {
    console.log('Check state of unknown request:  ', await api.poll.requestState(BAD_REQUEST));
  } catch (error) {
    console.log(error.toString());
  }

  try {
    console.log('Check state of previous request:  ', await api.poll.requestState(requestId));
  } catch (error) {
    console.log(error.toString());
  }


  return;
}

if (require.main === module) main();