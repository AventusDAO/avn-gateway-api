const assert = require('chai').assert;
const helper = require('./helper.js');
const accounts = helper.ACCOUNTS;
const token = helper.TOKEN;
const BN = helper.BN;
const bnEquals = helper.bnEquals;

describe('Send transactions:', async() => {
  let api;
  let relayer, sender, recipient;

  before(async () => {
    api = await helper.avnApi();
    relayer = accounts.relayer.address;
    sender = accounts.suri.address;
    recipient = accounts.user1.address;
  })

  describe('transferToken', async () => {
    let senderBalanceBefore, recipientBalanceBefore;
    let senderNonceBefore;

    before(async () => {
      senderBalanceBefore = new BN(await api.query.getTokenBalance(sender, token));
      recipientBalanceBefore = new BN(await api.query.getTokenBalance(recipient, token));
      senderNonceBefore = new BN(await api.query.getAccountNonce(sender));
    })

    it('make multiple token transfers', async () => {
      const amount = new BN(1);
      const numTransfers = new BN(7);

      for (let i=0; i < numTransfers; i++) {
        await api.send.transferToken(relayer, sender, recipient, token, amount);
      }

      await helper.sleep(3000); // Ensure last tx was processed

      bnEquals(senderBalanceBefore.sub(amount.mul(numTransfers)), await api.query.getTokenBalance(sender, token));
      bnEquals(recipientBalanceBefore.add(amount.mul(numTransfers)), await api.query.getTokenBalance(recipient, token));
      bnEquals(senderNonceBefore.add(numTransfers), await api.query.getAccountNonce(sender));
    })
  })
})