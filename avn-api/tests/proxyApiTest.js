const assert = require('chai').assert;
const helper = require('./helper.js');
const accounts = helper.ACCOUNTS;
const BN = helper.BN;
const bnEquals = helper.bnEquals;
const BAD_TOKEN = '0x0000000000000000000000000000000000000000';
const ONE_AVT = new BN("1000000000000000000");

describe('Proxy api calls:', async () => {
  let api, token;
  let relayer, user, recipient;
  let relayerFee;

  before(async () => {
    token = helper.token;
    api = await helper.avnApi();
    relayer = accounts.relayer.address;
    user = accounts.user.address;
    recipient = accounts.otherUser.address;
    recipientPubKey = accounts.otherUser.publicKey;
    relayerFee = new BN((await api.query.getRelayerFees(relayer, user)).proxyTokenTransfer);
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
      const requestId = await api.send.transferToken(relayer, recipientPubKey, token, amount);

      await helper.confirmStatus(api, requestId, 'Processed');

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
        requestId = await api.send.transferToken(relayer, recipient, token, amount);
      }

      await helper.confirmStatus(api, requestId, 'Processed');

      bnEquals(userTokenBalanceBefore.sub(amount.mul(numTxBn)), new BN(await api.query.getTokenBalance(user, token)));
      bnEquals(recipientTokenBalanceBefore.add(amount.mul(numTxBn)), new BN(await api.query.getTokenBalance(recipient, token)));
      bnEquals(userNonceBefore.add(numTxBn), new BN(await api.query.getNonce(user, 'token')));
      bnEquals(userAvtBalanceBefore.sub(relayerFee.mul(numTxBn)), new BN(await api.query.getAvtBalance(user)));
      // TODO: include network fees when we've sorted the accounts out
      bnEquals(new BN(await api.query.getAvtBalance(relayer)).gte(relayerAvtBalanceBefore.add(relayerFee.mul(numTxBn))));
    });
  });

  describe('staking', async () => {
    let stakerStakingStatusBefore, stakerAvtBalance;

    beforeEach(async () => {
      stakerStakingStatusBefore = await api.query.getAccountInfo(user);
      stakerAvtBalance = new BN(await api.query.getAvtBalance(user));
    });

    it('can stake', async () => {
      assert(stakerAvtBalance.gt(new BN(0)), 'Staker must have some AVT to stake');

      const amount = (new BN("100").mul(ONE_AVT));

      const requestId = await api.send.stake(relayer, amount.toString());
      await helper.confirmStatus(api, requestId, 'Processed');

      let stakerStakingStatusAfter = await api.query.getAccountInfo(user);

      bnEquals(new BN(stakerStakingStatusBefore.stakedBalance).add(amount), new BN(stakerStakingStatusAfter.stakedBalance));
    });

    it('can stake more funds', async () => {
      assert(stakerAvtBalance.gt(new BN(0)), 'Staker must have some AVT to stake');

      const amount = (new BN("1").mul(ONE_AVT));

      const requestId = await api.send.stake(relayer, amount.toString());
      await helper.confirmStatus(api, requestId, 'Processed');

      let stakerStakingStatusAfter = await api.query.getAccountInfo(user);

      bnEquals(new BN(stakerStakingStatusBefore.stakedBalance).add(amount), new BN(stakerStakingStatusAfter.stakedBalance));
    });

    // TODO: Re-enable when we can free up user's unlocked chunks
    xit('can request to withdraw stake', async () => {
      assert(stakerAvtBalance.gt(new BN(0)), 'Staker must have some AVT to stake');

      const amount = (new BN("1").mul(ONE_AVT));

      const requestId = await api.send.unstake(relayer, amount.toString());
      await helper.confirmStatus(api, requestId, 'Processed');

      let stakerStakingStatusAfter = await api.query.getAccountInfo(user);

      //Staked balance decreases by amount
      bnEquals(new BN(stakerStakingStatusBefore.stakedBalance).sub(amount), new BN(stakerStakingStatusAfter.stakedBalance));
      //Unstaked balance increases by amount
      bnEquals(new BN(stakerStakingStatusBefore.unstakedBalance).add(amount), new BN(stakerStakingStatusAfter.unstakedBalance));
    });

    it('can withdraw unlocked stake', async () => {
      if (new BN(stakerStakingStatusBefore.unlockedBalance).gt(new BN(0))) {
        const requestId = await api.send.withdrawUnlocked(relayer);
        await helper.confirmStatus(api, requestId, 'Processed');

        let stakerStakingStatusAfter = await api.query.getAccountInfo(user);

        //Free balance has increased
        bnEquals(
          new BN(stakerStakingStatusBefore.freeBalance).add(new BN(stakerStakingStatusBefore.unlockedBalance)),
          new BN(stakerStakingStatusAfter.freeBalance)
        );

        //Unstaked balance increases by amount
        bnEquals(new BN(stakerStakingStatusAfter.unlockedBalance), new BN(0));
      } else {
        console.log(`There are no unlocked funds, skipping test: [can withdraw unlocked stake]`);
      }
    });

    it('can payout stakers', async () => {
      let validator = accounts.avnValidator.address;
      let validatorStakingStatusBefore = await api.query.getAccountInfo(validator);

      const requestId = await api.send.payoutStakers(relayer);
      await helper.confirmStatus(api, requestId, 'Processed');

      let validatorStakingStatusAfter = await api.query.getAccountInfo(validator);

      //Free balance has increased
      assert(new BN(validatorStakingStatusAfter.freeBalance).gt(validatorStakingStatusBefore.freeBalance), 'Rewards should have been paid');
    });

  });

});
