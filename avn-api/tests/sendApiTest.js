const assert = require('chai').assert;
const helper = require('./helper.js');
const accounts = helper.ACCOUNTS;
const token = helper.TOKEN;
const BN = helper.BN;
const bnEquals = helper.bnEquals;

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
      const amount = new BN(1);
      const numTransfers = new BN(1); // TODO - increase when we add relayer nonce service

      for (let i=0; i < numTransfers; i++) {
        await api.send.transferToken(relayer, sender, user1, token, amount);
      }

      await helper.sleep(5000);

      bnEquals(senderBalanceBefore.sub(amount.mul(numTransfers)), await api.query.getTokenBalance(sender, token));
      bnEquals(recipientBalanceBefore.add(amount.mul(numTransfers)), await api.query.getTokenBalance(user1, token));
      bnEquals(relayerNonceBefore.add(numTransfers), await api.query.getAccountNonce(relayer));
      bnEquals(senderNonceBefore.add(numTransfers), await api.query.getAccountNonce(sender));
    })
  })
})