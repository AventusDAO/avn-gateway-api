const chai = require('chai');
const expect = chai.expect;
const assert = chai.assert;
chai.use(require('chai-as-promised'));
const helper = require('./helper.js');
const accounts = helper.ACCOUNTS;
const BN = helper.BN;
const bnEquals = helper.bnEquals;
const common = require('../lib/common.js');

const user = accounts.user.address;
const relayer = accounts.relayer.address;
const rewardPayer = accounts.rewardPayer.address;
const ONE_AVT = new BN('1000000000000000000');
const ZERO = new BN('0');

const unlockStakedBalance = async api => {
  let activeEra = await api.query.getActiveEra();
  let stakingDelay = await api.query.getStakingDelay();
  let unlockedEra = stakingDelay + activeEra;
  console.log(`Waiting for unstaked balance to be unlocked: currentEra = ${activeEra} | unlockingEra = ${unlockedEra}`);
  while (activeEra < unlockedEra) {
    await helper.sleep(10000);
    activeEra = await api.query.getActiveEra();
  }
};

const firstTimeStake = async (api, amount) => {
  const requestId = await api.send.stake(amount);
  await helper.confirmStatus(api, requestId, 'Processed');
};

const forceRewards = async api => {
  let payerAvtBalance = new BN(await api.query.getAvtBalance(rewardPayer));
  if (payerAvtBalance.eq(new BN(0))) {
    const requestId = await api.send.transferAvt(rewardPayer, ONE_AVT);
    await helper.confirmStatus(api, requestId, 'Processed');
  }
};

const withdrawStakedBalance = async (api, amount) => {
  let requestId;
  let accountInfo = await api.query.getAccountInfo(user);

  if (
    accountInfo &&
    new BN(accountInfo.stakedBalance).gt(
        new BN(accountInfo.unlockedBalance).add(new BN(accountInfo.unstakedBalance)))
  ) {
    let stakedValue = amount ?? new BN(accountInfo?.stakedBalance);
    requestId = await api.send.unstake(stakedValue);
    await helper.confirmStatus(api, requestId, 'Processed');
  }

  accountInfo = await api.query.getAccountInfo(user);
  if (new BN(accountInfo?.unstakedBalance).gt(new BN(0))) await unlockStakedBalance(api);

  requestId = await api.send.withdrawUnlocked();
  await helper.confirmStatus(api, requestId, 'Processed');
};

describe('Staking', async () => {
  let api;
  let minimumFirstTimeStakingValue;
  let testsFirstTimeStakingValue;
  before(async () => {
    api = await helper.avnApi();
    let minStakingValuePerValidator = new BN(await api.query.getMinTotalNominatorStake());
    let validators = await api.query.getValidatorsToNominate();
    // We add one avt to the minimumStakingValue so we can use this value to setup tests that need to withdraw balance
    // and stay above the minimum staking value.
    minimumFirstTimeStakingValue = new BN(minStakingValuePerValidator.mul(new BN(validators.length)));
    testsFirstTimeStakingValue = minimumFirstTimeStakingValue.add(ONE_AVT);
  });

  describe('Successful cases', function () {
    describe('First-time stake, with amount greater than minimum limit', function () {
      let stakingBalanceBefore;
      let stakingBalanceAfter;

      before(async () => {
        const stakingStatus = await api.query.getStakingStatus(user);
        if (stakingStatus === common.STAKING_STATUS.isStaking) await withdrawStakedBalance(api);
        stakingBalanceBefore = await api.query.getAccountInfo(user);
        await firstTimeStake(api, testsFirstTimeStakingValue);
        stakingBalanceAfter = await api.query.getAccountInfo(user);
      });

      it('Staked balance is increased by the bonded amount', async () => {
        bnEquals(
          new BN(stakingBalanceBefore.stakedBalance).add(testsFirstTimeStakingValue),
          new BN(stakingBalanceAfter.stakedBalance)
        );
      });
      it('Free balance is decreased by the bonded amount', async () => {
        assert(new BN(stakingBalanceBefore.freeBalance).gt(new BN(stakingBalanceAfter.freeBalance)));
      });
    });

    describe('Stake more', function () {
      let stakingBalanceBefore;
      let stakingBalanceAfter;

      before(async () => {
        const stakingStatus = await api.query.getStakingStatus(user);
        if (stakingStatus === common.STAKING_STATUS.isNotStaking) await firstTimeStake(api, testsFirstTimeStakingValue);

        stakingBalanceBefore = await api.query.getAccountInfo(user);
        const requestId = await api.send.stake(ONE_AVT);
        await helper.confirmStatus(api, requestId, 'Processed');
        stakingBalanceAfter = await api.query.getAccountInfo(user);
      });

      it('Staked balance is increased by the extra bonded amount', async () => {
        bnEquals(new BN(stakingBalanceBefore.stakedBalance).add(ONE_AVT), new BN(stakingBalanceAfter.stakedBalance));
      });
      it('Free balance is decreased by the extra bonded amount', async () => {
        assert(new BN(stakingBalanceBefore.freeBalance).gt(new BN(stakingBalanceAfter.freeBalance)));
      });
    });

    describe('Request to withdraw', function () {
      let stakingBalanceBefore;
      let stakingBalanceAfter;

      before(async () => {
        const stakingStatus = await api.query.getStakingStatus(user);
        if (stakingStatus === common.STAKING_STATUS.isNotStaking) await firstTimeStake(api, testsFirstTimeStakingValue);

        stakingBalanceBefore = await api.query.getAccountInfo(user);
        const requestId = await api.send.unstake(ONE_AVT);
        await helper.confirmStatus(api, requestId, 'Processed');
        stakingBalanceAfter = await api.query.getAccountInfo(user);
      });

      it('Unbonding balance is increased by the unbonded amount', async () => {
        bnEquals(new BN(stakingBalanceBefore.unstakedBalance).add(ONE_AVT), new BN(stakingBalanceAfter.unstakedBalance));
      });
    });

    describe('Withdraw funds', function () {
      let stakingBalanceBefore;
      let stakingBalanceAfter;
      let requestId;

      before(async () => {
        const stakingStatus = await api.query.getStakingStatus(user);
        if (stakingStatus === common.STAKING_STATUS.isNotStaking) {
          await firstTimeStake(api, testsFirstTimeStakingValue);
          requestId = await api.send.unstake(ONE_AVT);
          await helper.confirmStatus(api, requestId, 'Processed');
        }

        stakingBalanceBefore = await api.query.getAccountInfo(user);
        if (new BN(stakingBalanceBefore?.unstakedBalance).gt(new BN(0))) await unlockStakedBalance(api);

        stakingBalanceBefore = await api.query.getAccountInfo(user);
        requestId = await api.send.withdrawUnlocked();
        await helper.confirmStatus(api, requestId, 'Processed');
        stakingBalanceAfter = await api.query.getAccountInfo(user);
      });

      it('Staked balance is decreased by the extra bonded amount', async () => {
        bnEquals(new BN(stakingBalanceBefore.stakedBalance).sub(ONE_AVT), new BN(stakingBalanceAfter.stakedBalance));
      });
      it('Unbonding balance remains the same', async () => {
        bnEquals(new BN(stakingBalanceBefore.unstakedBalance), new BN(stakingBalanceAfter.unstakedBalance));
      });
      it('Free balance is increased by the withdrawn amount', async () => {
        assert(new BN(stakingBalanceBefore.freeBalance).lt(new BN(stakingBalanceAfter.freeBalance)));
      });
      it('Unbonded balance is decreased by the withdrawn amount', async () => {
        bnEquals(new BN(stakingBalanceBefore.unlockedBalance).sub(ONE_AVT), new BN(stakingBalanceAfter.unlockedBalance));
      });
    });

    describe('Request and Withdraw full staked amount', function () {
      let stakingBalanceBefore;
      let stakingBalanceAfter;

      before(async () => {
        const stakingStatus = await api.query.getStakingStatus(user);
        if (stakingStatus === common.STAKING_STATUS.isNotStaking) await firstTimeStake(api, testsFirstTimeStakingValue);

        stakingBalanceBefore = await api.query.getAccountInfo(user);
        await withdrawStakedBalance(api);
        stakingBalanceAfter = await api.query.getAccountInfo(user);
      });

      it('Staked balance is now zero', async () => {
        bnEquals(new BN(0), new BN(stakingBalanceAfter.stakedBalance));
      });
      it('Free balance is increased by the withdrawn amount', async () => {
        assert(new BN(stakingBalanceBefore.freeBalance).lt(new BN(stakingBalanceAfter.freeBalance)));
      });
    });

    describe('Request and withdraw a value that reduces the stake below the limit per collator', function () {
      let stakingBalanceBefore;
      let stakingBalanceAfter;

      before(async () => {
        const stakingStatus = await api.query.getStakingStatus(user);
        if (stakingStatus === common.STAKING_STATUS.isNotStaking) await firstTimeStake(api, testsFirstTimeStakingValue);

        let stakingBalanceBefore = await api.query.getAccountInfo(user);
        let withdrawValue = new BN(
          new BN(stakingBalanceBefore?.stakedBalance).sub(minimumFirstTimeStakingValue)
        ).add(new BN(1));
        await withdrawStakedBalance(api, withdrawValue);
        stakingBalanceAfter = await api.query.getAccountInfo(user);
      });

      it('Staked balance is now zero', async () => {
        bnEquals(new BN(0), new BN(stakingBalanceAfter.stakedBalance));
      });
      it('Free balance is increased by the withdrawn amount', async () => {
        assert(new BN(stakingBalanceBefore.freeBalance).lt(new BN(stakingBalanceAfter.freeBalance)));
      });
    });

    describe('Rewards get paid after an era', function () {
      let stakingBalanceBefore;
      let stakingBalanceAfter;

      before(async () => {
        const stakingStatus = await api.query.getStakingStatus(user);
        if (stakingStatus === common.STAKING_STATUS.isNotStaking) await firstTimeStake(api, testsFirstTimeStakingValue);

        await forceRewards(api);

        stakingBalanceBefore = await api.query.getAccountInfo(user);
        await unlockStakedBalance(api);
        stakingBalanceAfter = await api.query.getAccountInfo(user);
      });

      it('Free balance is increased by the withdrawn amount', async () => {
        assert(new BN(stakingBalanceBefore.freeBalance).lt(new BN(stakingBalanceAfter.freeBalance)));
      });
    });
  });

  describe('Failure cases', function () {
    describe('Stake', function () {
      before(async () => {
        const stakingStatus = await api.query.getStakingStatus(user);
        if (stakingStatus === common.STAKING_STATUS.isStaking) await withdrawStakedBalance(api);
      });
      it('a null value', async () => {
        await expect(api.send.stake(null)).to.be.rejectedWith(/Invalid amount type:/);
      });
      it('an empty value', async () => {
        await expect(api.send.stake('')).to.be.rejectedWith(/Invalid amount type:/);
      });
      it('a non-numeric string as value', async () => {
        await expect(api.send.stake('string')).to.be.rejectedWith(/Invalid amount type:/);
      });
      it('a negative value', async () => {
        await expect(api.send.stake(-1)).to.be.rejectedWith(/Invalid amount type:/);
      });
      it('a zero value', async () => {
        await expect(api.send.stake(ZERO)).to.be.rejectedWith(/Invalid amount type:/);
      });
      it('less than minimum staking value', async () => {
        const requestId = await api.send.stake(minimumFirstTimeStakingValue.sub(ONE_AVT));
        await helper.confirmStatus(api, requestId, 'Rejected');
      });
      it('more than your available balance', async () => {
        let accountBalances = await api.query.getAccountInfo(user);
        let stakingValue = new BN(accountBalances?.freeBalance).add(ONE_AVT);
        const requestId = await api.send.stake(stakingValue);
        await helper.confirmStatus(api, requestId, 'Rejected');
      });
    });

    describe('Request to withdraw', function () {
      before(async () => {
        const stakingStatus = await api.query.getStakingStatus(user);
        if (stakingStatus === common.STAKING_STATUS.isNotStaking) await firstTimeStake(api, testsFirstTimeStakingValue);
      });
      it('a null value', async () => {
        await expect(api.send.unstake(null)).to.be.rejectedWith(/Invalid amount type:/);
      });
      it('an empty value', async () => {
        await expect(api.send.unstake('')).to.be.rejectedWith(/Invalid amount type:/);
      });
      it('a non-numeric string as value', async () => {
        await expect(api.send.unstake(relayer, 'string')).to.be.rejectedWith(/Invalid amount type:/);
      });
      it('a negative value', async () => {
        await expect(api.send.unstake(-1)).to.be.rejectedWith(/Invalid amount type:/);
      });
      it('more than your staked balance', async () => {
        let accountBalances = await api.query.getAccountInfo(user);
        let withdrawValue = new BN(accountBalances?.stakedBalance).add(ONE_AVT);
        const requestId = await api.send.unstake(withdrawValue);
        await helper.confirmStatus(api, requestId, 'Rejected');
      });
    });
  });
});