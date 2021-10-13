const assert = require('chai').assert;
const helper = require('./helper.js');
const accounts = helper.ACCOUNTS;
const token = helper.TOKEN;
const BN = helper.BN;

describe('Send transactions:', async() => {
  let api;
  let relayer, sender, user1;

  before(async () => {
    api = await helper.avnApi();
    relayer = accounts.relayer.address;
    sender = accounts.sender.address;
    user1 = accounts.user1.address;
  })

  describe('transferToken', async () => {
    let senderBalanceBefore, recipientBalanceBefore;
    let relayerNonceBefore, senderNonceBefore;

    before(async () => {
      senderBalanceBefore = new BN(await api.query.getTokenBalance(sender, token));
      recipientBalanceBefore = new BN(await api.query.getTokenBalance(user1, token));
      relayerNonceBefore = new BN(await api.query.getAccountNonce(relayer));
      senderNonceBefore = new BN(await api.query.getAccountNonce(sender));
    })

    it('make multiple token transfers', async () => {
      const amount = 1;
      const numTransfers = 1; // TODO - increase when we add relayer nonce service

      for (let i=0; i < numTransfers; i++) {
        await api.send.transferToken(relayer, sender, user1, token, amount);
      }

      await helper.sleep(5000);

      console.log(senderBalanceBefore.minus(amount * numTransfers), await api.query.getTokenBalance(sender, token));
      console.log(recipientBalanceBefore.add(amount * numTransfers), await api.query.getTokenBalance(user1, token));
      console.log(relayerNonceBefore.add(numTransfers), await api.query.getAccountNonce(relayer));
      console.log(senderNonceBefore.add(numTransfers), await api.query.getAccountNonce(sender));
    })
  })
})