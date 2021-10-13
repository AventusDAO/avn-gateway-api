const assert = require('chai').assert;
const helper = require('./helper.js');
const accounts = helper.ACCOUNTS;
const token = helper.TOKEN;
const BN = helper.BN;
const bnEquals = helper.bnEquals;

const waitForTxToBeMined = async() => await helper.sleep(3000);

describe('Send transactions:', async() => {
  let api;
  let relayer, sender, recipient;

  before(async () => {
    api = await helper.avnApi();
    relayer = accounts.relayer.address;
    sender = accounts.suri.address;
    recipient = accounts.user1.address;
    recipientPubKey = accounts.user1.publicKey;
  })

  describe('transfer AVT', async () => {
    let recipientBalanceBefore;

    beforeEach(async () => {
      recipientBalanceBefore = new BN(await api.query.getAvtBalance(recipient));
    })

    it('can transfer AVT using recipient address', async () => {
      const amount = new BN(1);
      await api.send.transferAvt(recipient, amount);
      await waitForTxToBeMined();
      bnEquals(recipientBalanceBefore.add(amount), await api.query.getAvtBalance(recipient));
    })

    it('can transfer AVT using recipient public key', async () => {
      const amount = new BN(2);
      await api.send.transferAvt(recipientPubKey, amount);
      await waitForTxToBeMined();
      bnEquals(recipientBalanceBefore.add(amount), await api.query.getAvtBalance(recipientPubKey));
    })
  })

  describe('proxy token transfers', async () => {
    let senderBalanceBefore, recipientBalanceBefore;
    let senderNonceBefore;

    beforeEach(async () => {
      senderBalanceBefore = new BN(await api.query.getTokenBalance(sender, token));
      recipientBalanceBefore = new BN(await api.query.getTokenBalance(recipient, token));
      senderNonceBefore = new BN(await api.query.getAccountNonce(sender));
    })

    it('can transfer tokens using recipient public key', async () => {
      const amount = new BN(1);
      await api.send.transferToken(relayer, sender, recipientPubKey, token, amount);
      await waitForTxToBeMined();
      bnEquals(senderBalanceBefore.sub(amount), await api.query.getTokenBalance(sender, token));
      bnEquals(recipientBalanceBefore.add(amount), await api.query.getTokenBalance(recipient, token));
      bnEquals(senderNonceBefore.add(new BN(1)), await api.query.getAccountNonce(sender));
    })

    it('can make multiple token transfers using recipient address', async () => {
      const amount = new BN(2);
      const numTransfers = new BN(5);

      for (let i=0; i < numTransfers; i++) {
        await api.send.transferToken(relayer, sender, recipient, token, amount);
      }

      await waitForTxToBeMined();
      bnEquals(senderBalanceBefore.sub(amount.mul(numTransfers)), await api.query.getTokenBalance(sender, token));
      bnEquals(recipientBalanceBefore.add(amount.mul(numTransfers)), await api.query.getTokenBalance(recipient, token));
      bnEquals(senderNonceBefore.add(numTransfers), await api.query.getAccountNonce(sender));
    })
  })
})