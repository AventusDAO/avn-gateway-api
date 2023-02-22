const chai = require('chai');
const expect = chai.expect;
const assert = chai.assert;
const helper = require('./helper.js');
const accounts = helper.ACCOUNTS;
const BN = helper.BN;
const bnEquals = helper.bnEquals;
const common = require('../lib/common.js');

const user = accounts.payer.address;
const relayer = accounts.relayer.address;
const rewardPayer = accounts.rewardPayer.address;
const ONE_AVT = new BN('1000000000000000000');

let unlockStakedBalance = async(api) => {
    let activeEra = await api.query.getActiveEra();
    let stakingDelay = await api.query.getStakingDelay();
    let unlockedEra = stakingDelay + activeEra;
    while(activeEra < unlockedEra) {
        console.log(`Waiting for unstaked balance to be unlocked: currentEra = ${activeEra} | unlockingEra = ${unlockedEra}`);
        await helper.sleep(60000);
        activeEra = await api.query.getActiveEra();
    }
}

let firstTimeStake = async(api, amount) => {
    const requestId = await api.send.stake(relayer, amount);
    await helper.confirmStatus(api, requestId, 'Processed');
}

let forceRewards = async(api) => {
    let payerAvtBalance = new BN(await api.query.getAvtBalance(rewardPayer));
    if (payerAvtBalance.eq(new BN(0))) {
        const requestId = await api.send.transferAvt(relayer, rewardPayer, ONE_AVT);
        await helper.confirmStatus(api, requestId, 'Processed');
    }
}

let leaveNominators = async(api, amount) => {
    let requestId;
    let stakingBalance = await api.query.getAccountInfo(user);

    if(stakingBalance && new BN(stakingBalance.stakedBalance).gt(new BN(stakingBalance.unlockedBalance).add(new BN(stakingBalance.unstakedBalance)))) {
        let stakedValue = amount || new BN(stakingBalance && stakingBalance.stakedBalance);
        requestId = await api.send.unstake(relayer, stakedValue);
        await helper.confirmStatus(api, requestId, 'Processed');
    }

    stakingBalance = await api.query.getAccountInfo(user);
    if (new BN(stakingBalance && stakingBalance.unstakedBalance).gt(new BN(0)))
        await unlockStakedBalance(api);

    requestId = await api.send.withdrawUnlocked(relayer);
    await helper.confirmStatus(api, requestId, 'Processed');
}

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

    describe('Successful cases', function() {
        describe('First-time stake, with amount greater than minimum limit', function() {
            let stakingBalanceBefore;
            let stakingBalanceAfter;

            before(async () => {
                const stakingStatus = await api.query.getStakingStatus(user);
                if (stakingStatus === common.STAKING_STATUS.isStaking)
                    await leaveNominators(api);

                stakingBalanceBefore = await api.query.getAccountInfo(user);
                await firstTimeStake(api, testsFirstTimeStakingValue);
                stakingBalanceAfter = await api.query.getAccountInfo(user);
            });
            it('Staked balance is increased by the bonded amount', async () => {
                bnEquals(new BN(stakingBalanceBefore.stakedBalance).add(testsFirstTimeStakingValue), new BN(stakingBalanceAfter.stakedBalance));
            });
            it('Free balance is decreased by the bonded amount', async () => {
                assert(new BN(stakingBalanceBefore.freeBalance).gt(new BN(stakingBalanceAfter.freeBalance)));
            });
        });
        describe('Stake more', function() {
            let stakingBalanceBefore;
            let stakingBalanceAfter;

            before(async () => {
                const stakingStatus = await api.query.getStakingStatus(user);
                if (stakingStatus === common.STAKING_STATUS.isNotStaking)
                    await firstTimeStake(api, testsFirstTimeStakingValue);

                stakingBalanceBefore = await api.query.getAccountInfo(user);
                const requestId = await api.send.stake(relayer, ONE_AVT);
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
        describe('Request to withdraw', function() {
            let stakingBalanceBefore;
            let stakingBalanceAfter;

            before(async () => {
                const stakingStatus = await api.query.getStakingStatus(user);
                if (stakingStatus === common.STAKING_STATUS.isNotStaking)
                    await firstTimeStake(api, testsFirstTimeStakingValue);

                stakingBalanceBefore = await api.query.getAccountInfo(user);
                const requestId = await api.send.unstake(relayer, ONE_AVT);
                await helper.confirmStatus(api, requestId, 'Processed');
                stakingBalanceAfter = await api.query.getAccountInfo(user);
            });
            it('Unbonding balance is increased by the unbonded amount', async() => {
                bnEquals(new BN(stakingBalanceBefore.unstakedBalance).add(ONE_AVT), new BN(stakingBalanceAfter.unstakedBalance));
            });
        });
        describe('Withdraw funds', function() {
            let stakingBalanceBefore;
            let stakingBalanceAfter;
            let requestId;

            before(async () => {
                const stakingStatus = await api.query.getStakingStatus(user);
                if (stakingStatus === common.STAKING_STATUS.isNotStaking) {
                    await firstTimeStake(api, testsFirstTimeStakingValue);
                    requestId = await api.send.unstake(relayer, ONE_AVT);
                    await helper.confirmStatus(api, requestId, 'Processed');
                }

                stakingBalanceBefore = await api.query.getAccountInfo(user);
                if (new BN(stakingBalanceBefore && stakingBalanceBefore.unstakedBalance).gt(new BN(0)))
                    await unlockStakedBalance(api);

                stakingBalanceBefore = await api.query.getAccountInfo(user);
                requestId = await api.send.withdrawUnlocked(relayer);
                await helper.confirmStatus(api, requestId, 'Processed');
                stakingBalanceAfter = await api.query.getAccountInfo(user);
            });
            it('Staked balance is decreased by the extra bonded amount', async() => {
                bnEquals(new BN(stakingBalanceBefore.stakedBalance).sub(ONE_AVT), new BN(stakingBalanceAfter.stakedBalance));
            });
            it('Unbonding balance remains the same by the withdrawn amount', async() => {
                bnEquals(new BN(stakingBalanceBefore.unstakedBalance), new BN(stakingBalanceAfter.unstakedBalance));
            });
            it('Free balance is increased by the withdrawn amount', async() => {
                assert(new BN(stakingBalanceBefore.freeBalance).lt(new BN(stakingBalanceAfter.freeBalance)));
            });
            it('Unbonded balance is decreased by the withdrawn amount', async() => {
                bnEquals(new BN(stakingBalanceBefore.unlockedBalance).sub(ONE_AVT), new BN(stakingBalanceAfter.unlockedBalance));
            });

        });
        describe('Request and Withdraw full staked amount', function() {
            let stakingBalanceBefore;
            let stakingBalanceAfter;

            before(async () => {
                const stakingStatus = await api.query.getStakingStatus(user);
                if (stakingStatus === common.STAKING_STATUS.isNotStaking)
                    await firstTimeStake(api, testsFirstTimeStakingValue);

                stakingBalanceBefore = await api.query.getAccountInfo(user);
                await leaveNominators(api);
                stakingBalanceAfter = await api.query.getAccountInfo(user);
            });
            it('Staked balance is now zero', async() => {
                bnEquals(new BN(0), new BN(stakingBalanceAfter.stakedBalance));
            });
            it('Free balance is increased by the withdrawn amount', async() => {
                assert(new BN(stakingBalanceBefore.freeBalance).lt(new BN(stakingBalanceAfter.freeBalance)));
            });
        });
        describe('Request and withdraw a value that reduces the stake below the limit per collator', function() {
            let stakingBalanceBefore;
            let stakingBalanceAfter;

            before(async () => {
                const stakingStatus = await api.query.getStakingStatus(user);
                if (stakingStatus === common.STAKING_STATUS.isNotStaking)
                    await firstTimeStake(api, testsFirstTimeStakingValue);

                let stakingBalanceBefore = await api.query.getAccountInfo(user);
                let withdrawValue = new BN(new BN(stakingBalanceBefore && stakingBalanceBefore.stakedBalance).sub(minimumFirstTimeStakingValue)).add(new BN(1));
                await leaveNominators(api, withdrawValue);
                stakingBalanceAfter = await api.query.getAccountInfo(user);
            });
            it('Staked balance is now zero', async() => {
                bnEquals(new BN(0), new BN(stakingBalanceAfter.stakedBalance));
            });
            it('Free balance is increased by the withdrawn amount', async() => {
                assert(new BN(stakingBalanceBefore && stakingBalanceBefore.freeBalance).lt(new BN(stakingBalanceAfter && stakingBalanceAfter.freeBalance)));
            });
        });
        describe('Rewards get paid after an era', function() {
            let stakingBalanceBefore;
            let stakingBalanceAfter;

            before(async () => {
                const stakingStatus = await api.query.getStakingStatus(user);
                if (stakingStatus === common.STAKING_STATUS.isNotStaking)
                    await firstTimeStake(api, testsFirstTimeStakingValue);

                await forceRewards(api);

                stakingBalanceBefore = await api.query.getAccountInfo(user);
                await unlockStakedBalance(api);
                stakingBalanceAfter = await api.query.getAccountInfo(user);
            });
            it('Free balance is increased by the withdrawn amount', async() => {
                assert(new BN(stakingBalanceBefore && stakingBalanceBefore.freeBalance).lt(new BN(stakingBalanceAfter && stakingBalanceAfter.freeBalance)));
            });
        });
    });
    describe('Failure cases', function() {
        describe('Stake', function() {
            before(async() => {
                const stakingStatus = await api.query.getStakingStatus(user);
                if (stakingStatus === common.STAKING_STATUS.isStaking)
                    await leaveNominators(api);
            });

            it('with a null relayer account', async() => {
                await expect(api.send.stake(null, testsFirstTimeStakingValue)).to.be.rejectedWith(
                    /Invalid account type:/
                );
            });
            it('with an empty relayer account', async() => {
                await expect(api.send.stake("", testsFirstTimeStakingValue)).to.be.rejectedWith(
                    /Invalid account type:/
                );
            });
            it('with an invalid relayer account', async() => {
                await expect(api.send.stake("invalid_account", testsFirstTimeStakingValue)).to.be.rejectedWith(
                    /Invalid account type:/
                );
            });
            it('a null value', async() => {
                await expect(api.send.stake(relayer, null)).to.be.rejectedWith(
                    /Invalid amount type:/
                );
            });
            it('an empty value', async() => {
                await expect(api.send.stake(relayer, "")).to.be.rejectedWith(
                    /Invalid amount type:/
                );
            });
            it('a string as value', async() => {
                await expect(api.send.stake(relayer, "string")).to.be.rejectedWith(
                    /Invalid amount type:/
                );
            });
            it('a negative value', async() => {
                await expect(api.send.stake(relayer, -1)).to.be.rejectedWith(
                    /Invalid amount type:/
                );
            });
            it('less than minimum staking value', async() => {
                const requestId = await api.send.stake(relayer, ONE_AVT);
                await helper.confirmStatus(api, requestId, 'Rejected');
            });
            it('more than your available balance', async() => {
                let accountBalances = await api.query.getAccountInfo(user);
                let stakingValue = new BN(accountBalances && accountBalances.freeBalance).add(ONE_AVT);
                const requestId = await api.send.stake(relayer, stakingValue);
                await helper.confirmStatus(api, requestId, 'Rejected');
            });
        });
        describe('Request to withdraw', function() {
            before(async() => {
                const stakingStatus = await api.query.getStakingStatus(user);
                if (stakingStatus === common.STAKING_STATUS.isNotStaking)
                    await firstTimeStake(api, testsFirstTimeStakingValue);
            });
            it('with a null relayer account', async() => {
                await expect(api.send.unstake(null, ONE_AVT)).to.be.rejectedWith(
                    /Invalid account type:/
                );
            });
            it('with an empty relayer account', async() => {
                await expect(api.send.unstake("", ONE_AVT)).to.be.rejectedWith(
                    /Invalid account type:/
                );
            });
            it('with an invalid relayer account', async() => {
                await expect(api.send.unstake("invalid_account", ONE_AVT)).to.be.rejectedWith(
                    /Invalid account type:/
                );
            });
            it('a null value', async() => {
                await expect(api.send.unstake(relayer, null)).to.be.rejectedWith(
                    /Invalid amount type:/
                );
            });
            it('an empty value', async() => {
                await expect(api.send.unstake(relayer, "")).to.be.rejectedWith(
                    /Invalid amount type:/
                );
            });
            it('a string as value', async() => {
                await expect(api.send.unstake(relayer, "string")).to.be.rejectedWith(
                    /Invalid character/
                );
            });
            it('a negative value', async() => {
                await expect(api.send.unstake(relayer, -1)).to.be.rejectedWith(
                    /Invalid amount type:/
                );
            });
            it('more than your staked balance', async() => {
                let accountBalances = await api.query.getAccountInfo(user);
                let withdrawValue = new BN(accountBalances && accountBalances.stakedBalance).add(ONE_AVT);
                const requestId = await api.send.unstake(relayer, withdrawValue);
                await helper.confirmStatus(api, requestId, 'Rejected');
            });
        });
        describe('Withdraw', function() {
            it('with a null sender account', async() => {
                await expect(api.send.withdrawUnlocked(null)).to.be.rejectedWith(
                    /Invalid account type:/
                );
            });
            it('with an empty sender account', async() => {
                await expect(api.send.withdrawUnlocked("")).to.be.rejectedWith(
                    /Invalid account type:/
                );
            });
            it('with an invalid sender account', async() => {
                await expect(api.send.withdrawUnlocked("invalid account")).to.be.rejectedWith(
                    /Invalid account type:/
                );
            });
        });
    });
});