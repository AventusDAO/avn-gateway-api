const assert = require('chai').assert;
const helper = require('./helper.js');
const BN = helper.BN;
const accounts = helper.ACCOUNTS;
const token = helper.TOKEN;

describe('Send transactions:', async() => {
  let api;
  let relayer, user1, user2, sender;

  before(async () => {
    api = await helper.avnApi();
    relayer = accounts.relayer.address;
    user1 = accounts.user1.address;
    user2 = accounts.user2.address;
    sender = accounts.sender.address;
  })

  describe('getTotalAvt', async () => {

    before(async () => {
      console.log(await api.query.getAccountNonce(relayer), 'relayer - avt:', await api.query.getAvtBalance(relayer), 'token:', await api.query.getTokenBalance(relayer, token))
      console.log(await api.query.getAccountNonce(sender), 'sender - avt:', await api.query.getAvtBalance(sender), 'token:', await api.query.getTokenBalance(sender, token))
      console.log(await api.query.getAccountNonce(user2), 'user2 - avt:', await api.query.getAvtBalance(user2), 'token:', await api.query.getTokenBalance(user2, token))
    })

    after(async () => {
      await helper.sleep(10000);
      console.log('relayer - avt:', await api.query.getAvtBalance(relayer), 'token:', await api.query.getTokenBalance(relayer, token))
      console.log('sender - avt:', await api.query.getAvtBalance(sender), 'token:', await api.query.getTokenBalance(sender, token))
      console.log('user2 - avt:', await api.query.getAvtBalance(user2), 'token:', await api.query.getTokenBalance(user2, token))
    })

    it('send multiple token transfers', async () => {
      const amount = 1;
      const numTransfers = 5;
      for (let i=0; i < numTransfers; i++) {
        console.log(await api.send.transferToken(relayer, sender, user2, token, amount));
      }
    })
  })
})