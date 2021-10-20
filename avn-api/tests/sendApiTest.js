const assert = require('chai').assert;
const helper = require('./helper.js');
const accounts = helper.ACCOUNTS;
const token = helper.TOKEN;
const BN = helper.BN;
const bnEquals = helper.bnEquals;

const waitForTxToBeMined = async() => await helper.sleep(3500);

describe('SendTx api calls:', async() => {
  let api;
  let relayer, sender, recipient;

  before(async () => {
    api = await helper.avnApi();
    relayer = accounts.relayer.address;
    sender = accounts.sender.address;
    recipient = accounts.user1.address;
    recipientPubKey = accounts.user1.publicKey;
  })

  describe('transferAVT', async () => {
    let recipientBalanceBefore;

    beforeEach(async () => {
      recipientBalanceBefore = new BN(await api.query.getAvtBalance(recipient));
    })

    it('can transfer AVT using a recipient address', async () => {
      const amount = new BN(1);
      await api.send.transferAvt(recipient, amount);
      await waitForTxToBeMined();
      bnEquals(recipientBalanceBefore.add(amount), await api.query.getAvtBalance(recipient));
    })

    it('can transfer AVT using a recipient public key', async () => {
      const amount = new BN(2);
      await api.send.transferAvt(recipientPubKey, amount);
      await waitForTxToBeMined();
      bnEquals(recipientBalanceBefore.add(amount), await api.query.getAvtBalance(recipientPubKey));
    })
  })
})