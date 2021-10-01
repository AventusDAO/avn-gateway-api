const AvnApi = require('./index.js')

const relayer = {
  address: '5FbUQ2kJWLoqHuSTSNNqBwKwdQnBVe4HF3TeGyu6UoZaryTh',
  publicKey: '0x9c2bfffc466eb9c1bad0d8393df93770468ee54b0a0f05232e4b5dde6960b004'
}

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
const MIN_AMOUNT = 1

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

  console.log('\n***Demonstrating Proxied Transactions***');
  let senderNonce = await api.query.getAccountNonce(user1.address);

  requestId = await api.send.transferToken(relayer.address, senderNonce, user1.address, user2.address, token, MIN_AMOUNT);
  console.log('Transfer token using recipient address. Returned hash:  ', requestId);
  senderNonce++;

  requestId = await api.send.transferToken(relayer.publicKey, senderNonce, user1.publicKey, user2.publicKey, token, MIN_AMOUNT)
  console.log('Transfer token using recipient public key. Returned hash:  ', requestId);
  senderNonce++;

  // Demonstrate that address and publicKey are interchangeable, and that we don't have one function signature for each
  // and also revert the initial transfers, so we don't have runaway balances
  requestId = await api.send.transferToken(relayer.publicKey, senderNonce, user2.publicKey, user1.address, token, MIN_AMOUNT);
  console.log('Transfer token using mixed. Returned hash:  ', requestId);
  senderNonce++;

  requestId = await api.send.transferToken(relayer.address, senderNonce, user2.address, user1.publicKey, token, MIN_AMOUNT)
  console.log('Transfer token using recipient public key. Returned hash:  ', requestId);
  senderNonce++;
  return;
}

if (require.main === module) main();