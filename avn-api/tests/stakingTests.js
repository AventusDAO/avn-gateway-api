const chai = require('chai');
const expect = chai.expect;
const assert = chai.assert;
const helper = require('./helper.js');
const accounts = helper.ACCOUNTS;
const BN = helper.BN;
const bnEquals = helper.bnEquals;

const amount = new BN('10000000000000000000');
const user = accounts.payer.address;
const relayer = accounts.relayer.address;
const FIFTY_AVT = new BN('50000000000000000000');
const ONE_AVT = new BN('1001000000000000000');
const gatewayFee = new BN('1000000000000000');


describe('Staking', async () => {
    let api;

    before(async () => {
        api = await helper.avnApi();
    });

    describe('Successful cases', function() {
        xdescribe('Staking stats', function() {
            let accountBalancesBefore;

            before(async () => {
                accountBalancesBefore = await api.query.getStakingStats();
            });
            it('Staking stats', async () => { // works
                console.log(accountBalancesBefore);
                assert( 1 == 1 );

            });
        });
        xdescribe('First-time stake, with amount greater than minimum limit', function() {
            let accountBalancesBefore;
            let accountBalanceAfter;

            before(async () => {
                accountBalancesBefore = await api.query.getAccountInfo(user);
                const requestId = await api.send.stake(relayer, FIFTY_AVT);
                await helper.confirmStatus(api, requestId, 'Processed');
                accountBalanceAfter = await api.query.getAccountInfo(user);
            });
            it('Staked balance is increased by the bonded amount', async () => { // works
                assert.equal(new BN(accountBalancesBefore.stakedBalance).add(FIFTY_AVT), new BN(accountBalanceAfter.stakedBalance))
            });
            xit('Locked balance is increased by the bonded amount');
            it('Free balance is decreased by the bonded amount', async () => {
                assert.equal(new BN(accountBalancesBefore.freeBalance), new BN(accountBalanceAfter.freeBalance).sub(FIFTY_AVT))
            });
        });
        describe('Stake more', function() {
            let accountBalancesBefore;
            let accountBalanceAfter;

            before(async () => {
                accountBalancesBefore = await api.query.getAccountInfo(user);
                console.log(accountBalancesBefore)
                const requestId = await api.send.stake(relayer, ONE_AVT);
                await helper.confirmStatus(api, requestId, 'Processed');
                accountBalanceAfter = await api.query.getAccountInfo(user);
                console.log(accountBalanceAfter)
            });

            it('Staked balance is increased by the extra bonded amount', async () => { // works
                // assert.equal(new BN(accountBalancesBefore.stakedBalance).add(ONE_AVT), new BN(accountBalanceAfter.stakedBalance))
                bnEquals(new BN(accountBalancesBefore.stakedBalance).add(ONE_AVT), new BN(accountBalanceAfter.stakedBalance));
            });
            it('Free balance is decreased by the extra bonded amount', async () => {
                // assert.equal(new BN(accountBalancesBefore.freeBalance), new BN(accountBalanceAfter.freeBalance).sub(ONE_AVT))
                bnEquals(new BN(accountBalancesBefore.freeBalance), new BN(accountBalanceAfter.freeBalance).sub(ONE_AVT));
            });
        });
        xdescribe('Request to withdraw', function() {
            let accountBalancesBefore;
            let accountBalanceAfter;

            before(async () => {
                accountBalancesBefore = await api.query.getAccountInfo(user);
                console.log(accountBalancesBefore)
                const requestId = await api.send.unstake(relayer, ONE_AVT);
                await helper.confirmStatus(api, requestId, 'Processed');
                accountBalanceAfter = await api.query.getAccountInfo(user);
                console.log(accountBalanceAfter)
            });
            xit('Staked balance is decreased by the unbonded amount', async() => {
                assert.equal(new BN(accountBalancesBefore.stakedBalance).sub(ONE_AVT), new BN(accountBalanceAfter.stakedBalance));
            });
            xit('Unbonding balance is increased by the unbonded amount', async() => {
                bnEquals(new BN(accountBalancesBefore.unstakedBalance).add(ONE_AVT), new BN(accountBalanceAfter.unstakedBalance));
                // assert.equal(new BN(accountBalancesBefore.unstakedBalance), new BN(accountBalanceAfter.unstakedBalance).add(ONE_AVT));
            });
            xit('Free balance remains the same by the unbonded amount', async() => {
                bnEquals(new BN(accountBalancesBefore.freeBalance), new BN(accountBalanceAfter.freeBalance));
                // assert.equal(new BN(accountBalancesBefore.freeBalance), new BN(accountBalanceAfter.freeBalance));
            });
        });
        xdescribe('Withdraw funds', function() {
            let accountBalancesBefore;
            let accountBalanceAfter;

            before(async () => {
                accountBalancesBefore = await api.query.getAccountInfo(user);
                console.log(accountBalancesBefore)
                const requestId = await api.send.withdrawUnlocked(relayer);
                await helper.confirmStatus(api, requestId, 'Processed');
                accountBalanceAfter = await api.query.getAccountInfo(user);
                console.log(accountBalanceAfter)
            });
            xit('Staked balance remains the same by the withdrawn amount', async() => {
                assert.equal(new BN(accountBalancesBefore.stakedBalance).sub(ONE_AVT), new BN(accountBalanceAfter.stakedBalance));
            });
            it('Unbonding balance remains the same by the withdrawn amount', async() => {
                assert.equal(new BN(accountBalancesBefore.unstakedBalance.toString()), new BN(accountBalanceAfter.unstakedBalance.toString()));
            });
            xit('Locked balance is decreased by the withdrawn amount');
            it('Free balance is increased by the withdrawn amount', async() => {
                assert.equal(new BN(accountBalancesBefore.freeBalance.toString()).add(ONE_AVT), new BN(accountBalanceAfter.freeBalance.toString()));
            });
            it('Unbonded balance is decreased by the withdrawn amount', async() => {
                assert.equal(new BN(accountBalancesBefore.unlockedBalance.toString()).sub(ONE_AVT), new BN(accountBalanceAfter.unlockedBalance.toString()));
            });
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