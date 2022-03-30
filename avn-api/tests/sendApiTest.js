const assert = require('chai').assert;
const helper = require('./helper.js');
const accounts = helper.ACCOUNTS;
const BN = helper.BN;
const bnEquals = helper.bnEquals;

const dummyT1Authority = '0xd6ae8250b8348c94847280928c79fb3b63ca453e';

describe('SendTx api calls:', async () => {
  let api;
  let token;
  let relayer, user, recipient, t1Recipient;
  let relayerFee, relayerLowerFee;

  before(async () => {
    api = await helper.avnApi();
    token = helper.token;
    relayer = accounts.relayer.address;
    user = accounts.user.address;
    recipient = accounts.otherUser.address;
    recipientPubKey = accounts.otherUser.publicKey;
    relayerFee = new BN((await api.query.getRelayerFees(relayer, user)).proxyAvtTransfer);
    relayerLowerFee = new BN((await api.query.getRelayerFees(relayer, user)).proxyTokenLower);
    t1Recipient = '0xFad45995bc1ceE164E7565e301F5736F3eed3Bb1'; // a dummy recipient as we are not checking the full lower path
  });

  describe('transferAVT', async () => {
    let userAvtBalanceBefore, recipientAvtBalanceBefore, relayerAvtBalanceBefore;

    beforeEach(async () => {
      userAvtBalanceBefore = new BN(await api.query.getAvtBalance(user));
      recipientAvtBalanceBefore = new BN(await api.query.getAvtBalance(recipient));
      relayerAvtBalanceBefore = new BN(await api.query.getAvtBalance(relayer));
    });

    it('can transfer AVT using a recipient address', async () => {
      const amount = new BN(1);
      const requestId = await api.send.transferAvt(relayer, recipient, amount);
      await helper.confirmStatus(api, requestId, 'Processed');

      bnEquals(recipientAvtBalanceBefore.add(amount), await api.query.getAvtBalance(recipient));
      bnEquals(userAvtBalanceBefore.sub(relayerFee).sub(amount), new BN(await api.query.getAvtBalance(user)));
      // TODO: include network fees when we've sorted the accounts out
      bnEquals(new BN(await api.query.getAvtBalance(relayer)).gte(relayerAvtBalanceBefore.add(relayerFee)));
    });

    it('can transfer AVT using a recipient public key', async () => {
      const amount = new BN(2);
      const requestId = await api.send.transferAvt(relayer, recipientPubKey, amount);
      await helper.confirmStatus(api, requestId, 'Processed');

      bnEquals(recipientAvtBalanceBefore.add(amount), await api.query.getAvtBalance(recipientPubKey));
      bnEquals(userAvtBalanceBefore.sub(relayerFee).sub(amount), new BN(await api.query.getAvtBalance(user)));
      // TODO: include network fees when we've sorted the accounts out
      bnEquals(new BN(await api.query.getAvtBalance(relayer)).gte(relayerAvtBalanceBefore.add(relayerFee)));
    });
  });

  describe('confirmTokenLift', async () => {
    it('can confirm a token lift', async () => {
      const dummyEthereumTransactionHash = helper.randomEthTxHash();
      const requestId = await api.send.confirmTokenLift(relayer, dummyEthereumTransactionHash);
      await helper.confirmStatus(api, requestId, 'Processed');
    });
  });

  describe('lowerToken', async () => {
    let userAvtBalanceBefore, userTokenBalanceBefore, relayerAvtBalanceBefore, userNonceBefore;

    beforeEach(async () => {
      userAvtBalanceBefore = new BN(await api.query.getAvtBalance(user));
      userTokenBalanceBefore = new BN(await api.query.getTokenBalance(user, token));
      relayerAvtBalanceBefore = new BN(await api.query.getAvtBalance(relayer));
      userNonceBefore = new BN(await api.query.getNonce(user, 'token'));
    });

    it('can lower tokens', async () => {
      const amount = new BN(2);
      const requestId = await api.send.lowerToken(relayer, t1Recipient, token, amount);
      await helper.confirmStatus(api, requestId, 'Processed');

      bnEquals(userTokenBalanceBefore.sub(amount), new BN(await api.query.getTokenBalance(user, token)));
      bnEquals(userNonceBefore.add(new BN(1)), new BN(await api.query.getNonce(user, 'token')));
      bnEquals(userAvtBalanceBefore.sub(relayerLowerFee), new BN(await api.query.getAvtBalance(user)));
      // TODO: include network fees when we've sorted the accounts out
      bnEquals(new BN(await api.query.getAvtBalance(relayer)).gte(relayerAvtBalanceBefore.add(relayerLowerFee)));
    });

    it('can lower AVT', async () => {
      const avtAddress = await api.query.getAvtContractAddress();
      const amount = new BN(3);
      const requestId = await api.send.lowerToken(relayer, t1Recipient, avtAddress, amount);
      await helper.confirmStatus(api, requestId, 'Processed');

      bnEquals(userAvtBalanceBefore.sub(relayerLowerFee).sub(amount), new BN(await api.query.getAvtBalance(user)));
      bnEquals(userNonceBefore.add(new BN(1)), new BN(await api.query.getNonce(user, 'token')));
      // TODO: include network fees when we've sorted the accounts out
      bnEquals(new BN(await api.query.getAvtBalance(relayer)).gte(relayerAvtBalanceBefore.add(relayerLowerFee)));
    });
  });
});
