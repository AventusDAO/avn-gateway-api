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

async function main() {
  const api = new AvnApi('https://n67ibi1ujh.execute-api.eu-west-2.amazonaws.com');

  console.log('Version:                             ', api.version);
  console.log('Total AVT:                           ', await api.query.getTotalAvt());
  console.log('User AVT balance by address:         ', await api.query.getAvtBalance(user1.address));
  console.log('User AVT balance by public key:      ', await api.query.getAvtBalance(user1.publicKey));
  console.log('User token balance by address:       ', await api.query.getTokenBalance(user2.address, token));
  console.log('User token balance by public key:    ', await api.query.getTokenBalance(user2.publicKey, token));
  console.log('User account nonce by address:       ', await api.query.getAccountNonce(user1.address));
  console.log('User account nonce by public key:    ', await api.query.getAccountNonce(user1.publicKey));
  console.log('Expect error:                        ', await api.query.getAccountNonce('0000'));

  return;
}

if (require.main === module) main();