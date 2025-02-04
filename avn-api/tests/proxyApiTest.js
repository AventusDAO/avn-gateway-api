const assert = require('chai').assert;
const helper = require('./helper.js');
const accounts = helper.ACCOUNTS;
const BN = helper.BN;
const bnEquals = helper.bnEquals;
const BAD_TOKEN = '0x0000000000000000000000000000000000000000';
const ONE_AVT = new BN('1000000000000000000');

describe('Proxy api calls:', async () => {
  let avnApi, api, token, avt;
  let relayer, user, recipient;
  let relayerFee;

  before(async () => {
    token = helper.token;
    avt = helper.avt;
    avnApi = await helper.avnApi({
      suri: accounts.user.seed
    });
    api = await avnApi.apis();
    relayer = accounts.relayer.address;
    user = accounts.user.address;
    recipient = accounts.otherUser.address;
    recipientPubKey = accounts.otherUser.publicKey;
    relayerFee = new BN((await api.query.getRelayerFees(relayer, avt, user)).proxyTokenTransfer);
  });

  describe('transferToken', async () => {
    let userAvtBalanceBefore, relayerAvtBalanceBefore, userTokenBalanceBefore, recipientTokenBalanceBefore;
    let userNonceBefore;

    beforeEach(async () => {
      userAvtBalanceBefore = new BN(await api.query.getAvtBalance(user));
      userTokenBalanceBefore = new BN(await api.query.getTokenBalance(user, token));
      recipientTokenBalanceBefore = new BN(await api.query.getTokenBalance(recipient, token));
      relayerAvtBalanceBefore = new BN(await api.query.getAvtBalance(relayer));
      userNonceBefore = new BN(await api.query.getNonce(user, 'token'));
    });

    it('can transfer tokens', async () => {
      const amount = new BN(2);
      const requestId = await api.send.transferToken(recipient, token, amount);

      await helper.confirmStatus(api.poll, requestId, 'Processed');

      bnEquals(userTokenBalanceBefore.sub(amount), new BN(await api.query.getTokenBalance(user, token)));
      bnEquals(recipientTokenBalanceBefore.add(amount), new BN(await api.query.getTokenBalance(recipient, token)));
      bnEquals(userNonceBefore.add(new BN(1)), new BN(await api.query.getNonce(user, 'token')));
      bnEquals(userAvtBalanceBefore.sub(relayerFee), new BN(await api.query.getAvtBalance(user)));
      // TODO: include network fees when we've sorted the accounts out
      bnEquals(new BN(await api.query.getAvtBalance(relayer)).gte(relayerAvtBalanceBefore.add(relayerFee)));
    });

    it('can make multiple token transfers using a recipient address', async function () {
      this.timeout(400000); //increase the timeout of this test (https://mochajs.org/#test-level)

      const amount = new BN(1);
      const numTx = 10;
      const numTxBn = new BN(numTx);
      let requestId;

      for (i = 0; i < numTx; i++) {
        requestId = await api.send.transferToken(recipient, token, amount);
      }

      await helper.confirmStatus(api.poll, requestId, 'Processed');

      bnEquals(userTokenBalanceBefore.sub(amount.mul(numTxBn)), new BN(await api.query.getTokenBalance(user, token)));
      bnEquals(recipientTokenBalanceBefore.add(amount.mul(numTxBn)), new BN(await api.query.getTokenBalance(recipient, token)));
      bnEquals(userNonceBefore.add(numTxBn), new BN(await api.query.getNonce(user, 'token')));
      bnEquals(userAvtBalanceBefore.sub(relayerFee.mul(numTxBn)), new BN(await api.query.getAvtBalance(user)));
      // TODO: include network fees when we've sorted the accounts out
      bnEquals(new BN(await api.query.getAvtBalance(relayer)).gte(relayerAvtBalanceBefore.add(relayerFee.mul(numTxBn))));
    });
  });
});
