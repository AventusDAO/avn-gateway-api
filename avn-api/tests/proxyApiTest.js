const assert = require('chai').assert;
const helper = require('./helper.js');
const accounts = helper.ACCOUNTS;
const token = helper.TOKEN;
const BN = helper.BN;
const bnEquals = helper.bnEquals;
const BAD_TOKEN = '0x0000000000000000000000000000000000000000';

const waitForTxToBeMined = async() => await helper.sleep(3500);

describe('Proxy api calls:', async() => {
  let api;
  let relayer, sender, recipient;

  before(async () => {
    api = await helper.avnApi();
    relayer = accounts.relayer.address;
    sender = accounts.client.address;
    recipient = accounts.user1.address;
    recipientPubKey = accounts.user1.publicKey;
  })

  describe('transferToken', async () => {
    let senderBalanceBefore, recipientBalanceBefore;
    let senderNonceBefore;

    beforeEach(async () => {
      senderBalanceBefore = new BN(await api.query.getTokenBalance(sender, token));
      recipientBalanceBefore = new BN(await api.query.getTokenBalance(recipient, token));
      senderNonceBefore = new BN(await api.query.getAccountNonce(sender));
    })

    it('can transfer tokens using a recipient public key', async () => {
      const amount = new BN(2);
      await api.send.transferToken(relayer, sender, recipientPubKey, token, amount);
      await waitForTxToBeMined();
      bnEquals(senderBalanceBefore.sub(amount), await api.query.getTokenBalance(sender, token));
      bnEquals(recipientBalanceBefore.add(amount), await api.query.getTokenBalance(recipient, token));
      bnEquals(senderNonceBefore.add(new BN(1)), await api.query.getAccountNonce(sender));
    })

    it('can make multiple token transfers using a recipient address', async () => {
      const amount = new BN(1);
      const numTx = new BN(6);
      const numGoodTx = numTx.sub(new BN(1));

      for (i = 0; i < numTx; i++) {
        if (i === 3) {
          assert.equal(await api.send.transferToken(relayer, sender, '0x', token, amount), 'Invalid params');
        } else {
          await api.send.transferToken(relayer, sender, recipient, token, amount);
        }
      }

      await waitForTxToBeMined();
      bnEquals(senderBalanceBefore.sub(amount.mul(numGoodTx)), await api.query.getTokenBalance(sender, token));
      bnEquals(recipientBalanceBefore.add(amount.mul(numGoodTx)), await api.query.getTokenBalance(recipient, token));
      bnEquals(senderNonceBefore.add(numGoodTx), await api.query.getAccountNonce(sender));
    })
  })
})