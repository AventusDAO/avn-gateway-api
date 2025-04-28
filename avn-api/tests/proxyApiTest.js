const assert = require('chai').assert;
const helper = require('./helper.js');
const { SetupMode, SigningMode } = require('avn-api');
const accounts = helper.ACCOUNTS;
const BN = helper.BN;
const bnEquals = helper.bnEquals;
const MINIMUM_REQUIRED_TEST_BALANCE = new BN(10);

describe('Proxy api calls:', async () => {
  let api, token;
  let relayer, user, recipient;
  let relayerFee;

  before(async () => {
    const signer = {
      sign: async (data, signerAddress) => {
        return await helper.remoteSigner(data, signerAddress);
      }
    };

    const options = {
      signer: signer,
      setupMode: SetupMode.MultiUser,
      signingMode: SigningMode.RemoteSigner
    };

    avnGateway = await helper.avnApi(options);
    api = await avnGateway.apis(accounts.user.address);
    bankApi = await avnGateway.apis(accounts.bank.address);

    token = helper.token;
    relayer = accounts.relayer.address;
    user = accounts.user.address;
    recipient = accounts.otherUser.address;
    recipientPubKey = accounts.otherUser.publicKey;

    console.log(`relayer: ${relayer}`);
    console.log(`helper.avt: ${helper.avt}`);
    console.log(`user: ${user}`);
    relayerFee = new BN((await api.query.getRelayerFees(relayer, helper.avt, user)).proxyTokenTransfer);
    console.log(`relayerFee: ${relayerFee}`);
  });

  describe('Test setup', function () {
    let senderTokenBalance;
    before(async () => {
      senderTokenBalance = new BN(await api.query.getTokenBalance(user, token));
    });

    describe('succeeds if', async function () {
      it('sender is funded', async function () {
        if (senderTokenBalance.lt(MINIMUM_REQUIRED_TEST_BALANCE)) {
          let amountLeft = MINIMUM_REQUIRED_TEST_BALANCE.sub(senderTokenBalance);

          const requestId = await bankApi.send.transferToken(user, token, amountLeft);
          await helper.confirmStatus(bankApi, requestId, 'Processed');

          senderTokenBalance = new BN(await api.query.getTokenBalance(user, token));
        }
        assert(senderTokenBalance.gte(MINIMUM_REQUIRED_TEST_BALANCE));
      });
    });
  });

  describe('transferToken', async () => {
    let userAvtBalanceBefore, relayerAvtBalanceBefore, userTokenBalanceBefore, recipientTokenBalanceBefore;
    let userNonceBefore;

    beforeEach(async () => {
      userAvtBalanceBefore = new BN(await api.query.getAvtBalance(user));
      userTokenBalanceBefore = new BN(await api.query.getTokenBalance(user, token));
      recipientTokenBalanceBefore = new BN(await api.query.getTokenBalance(recipient, token));
      relayerAvtBalanceBefore = new BN(await api.query.getAvtBalance(relayer));
      userNonceBefore = new BN(await api.query.getUserNonce(user, 'token'));
    });

    it('can transfer tokens', async () => {
      const amount = new BN(2);
      const requestId = await api.send.transferToken(recipientPubKey, token, amount);

      await helper.confirmStatus(api.poll, requestId, 'Processed');

      bnEquals(userTokenBalanceBefore.sub(amount), new BN(await api.query.getTokenBalance(user, token)));
      bnEquals(recipientTokenBalanceBefore.add(amount), new BN(await api.query.getTokenBalance(recipient, token)));
      bnEquals(userNonceBefore.add(new BN(1)), new BN(await api.query.getUserNonce(user, 'token')));
      bnEquals(userAvtBalanceBefore.sub(relayerFee), new BN(await api.query.getAvtBalance(user)));
      // TODO: include network fees when we've sorted the accounts out
      bnEquals(new BN(await api.query.getAvtBalance(relayer)).gte(relayerAvtBalanceBefore.add(relayerFee)));
    });

    xit('can make multiple token transfers using a recipient address', async function () {
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
      bnEquals(userNonceBefore.add(numTxBn), new BN(await api.query.getUserNonce(user, 'token')));
      bnEquals(userAvtBalanceBefore.sub(relayerFee.mul(numTxBn)), new BN(await api.query.getAvtBalance(user)));
      // TODO: include network fees when we've sorted the accounts out
      bnEquals(new BN(await api.query.getAvtBalance(relayer)).gte(relayerAvtBalanceBefore.add(relayerFee.mul(numTxBn))));
    });
  });
});
