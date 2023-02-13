const chai = require('chai');
const expect = chai.expect;
const assert = chai.assert;
const helper = require('./helper.js');
const accounts = helper.ACCOUNTS;
const BN = helper.BN;

const amount = new BN('10000000000000000000');
const user = accounts.payer.address;
const relayer = accounts.relayer.address;
const FIFTY_AVT = new BN('50000000000000000000');
const ONE_AVT = new BN('1000000000000000000');

describe('Staking', async () => {
    let api;

    before(async () => {
        api = await helper.avnApi();
    });

    describe('Successful cases', function() {
        xdescribe('First-time stake, with amount greater than minimum limit', function() {
            it('Staked balance is increased by the bonded amount', async () => { // works
                // const re = await api.query.getAccountInfo(user);
                // console.log(re);
                const stakingStatus = await api.query.getStakingStatus(user);
                console.log(stakingStatus);


                const requestId = await api.send.stake(relayer, FIFTY_AVT);

                console.log("requestId: " + requestId);

                await helper.confirmStatus(api, requestId, 'Processed');

                // const after = await api.query.getAccountInfo(user);
                // console.log(after);

                // let stakerStakingStatusAfter = await api.query.getAccountInfo(user);

                // bnEquals(new BN(stakerStakingStatusBefore.stakedBalance).add(amount), new BN(stakerStakingStatusAfter.stakedBalance));
            });
            xit('Locked balance is increased by the bonded amount');
            xit('Active balance is decreased by the bonded amount');
        });
        xdescribe('Stake more', function() {
            it('Staked balance is increased by the extra bonded amount', async () => { // works
                const stakingStatus = await api.query.getStakingStatus(user);
                console.log(stakingStatus);

                const requestId = await api.send.stake(relayer, ONE_AVT);

                console.log("requestId: " + requestId);

                await helper.confirmStatus(api, requestId, 'Processed');

            });
            xit('Locked balance is increased by the extra bonded amount');
            xit('Active balance is decreased by the extra bonded amount');
        });
        xdescribe('Request to withdraw', function() {
            it('Staked balance is decreased by the unbonded amount', async() => {
                const stakingStatus = await api.query.getStakingStatus(user);
                console.log(stakingStatus);

                const requestId = await api.send.unstake(relayer, ONE_AVT);

                console.log("requestId: " + requestId);

                await helper.confirmStatus(api, requestId, 'Processed');
            });
            xit('Unbonding balance is increased by the unbonded amount');
            xit('Locked balance remains the same by the unbonded amount');
            xit('Active balance remains the same by the unbonded amount');
        });
        describe('Withdraw funds', function() {
            it('Staked balance remains the same by the withdrawn amount', async() => {
                const stakingStatus = await api.query.getStakingStatus(user);
                console.log(stakingStatus);

                const requestId = await api.send.withdrawUnlocked(relayer);

                console.log("requestId: " + requestId);

                await helper.confirmStatus(api, requestId, 'Processed');
            });
            xit('Unbonding balance remains the same by the withdrawn amount');
            xit('Locked balance is decreased by the withdrawn amount');
            xit('Active balance is increased by the withdrawn amount');
            xit('Unbonded balance is decreased by the withdrawn amount');
        });
    });
    xdescribe('Failure cases', function() {
        xdescribe('Stake', function() {
            it('with a null sender account');
            it('with an empty sender account');
            it('with an invalid sender account');
            it('a null value');
            it('an empty value');
            it('a string as value');
            it('a negative value');
            it('less than minimum staking value');
            it('more than your available balance');
        });
        xdescribe('Stake more', function() {
            it('with a null sender account');
            it('with an empty sender account');
            it('with an invalid sender account');
            it('a null value');
            it('an empty value');
            it('a string as value');
            it('a negative value');
            it('more than your available balance');
        });
        xdescribe('Request to withdraw', function() {
            it('with a null sender account');
            it('with an empty sender account');
            it('with an invalid sender account');
            it('a null value');
            it('an empty value');
            it('a string as value');
            it('a negative value');
            it('more than your staked balance');
            it('a value that reduces the stake below the limit per collator');
            it('a value that reduces the stake below the absolute minimum limit');
        });
        xdescribe('Withdraw', function() {
            it('with a null sender account');
            it('with an empty sender account');
            it('with an invalid sender account');
            it('a null value');
            it('an empty value');
            it('a string as value');
            it('a negative value');
            it('more than your unbonded balance');
        });
    });
});