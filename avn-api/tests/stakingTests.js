describe('Staking', async () => {
    describe('Successful cases', function() {
        describe('First-time stake, with amount greater than minimum limit', function() {
            it('Staked balance is increased by the bonded amount');
            it('Locked balance is increased by the bonded amount');
            it('Active balance is decreased by the bonded amount');
        });
        describe('Stake more', function() {
            it('Staked balance is increased by the extra bonded amount');
            it('Locked balance is increased by the extra bonded amount');
            it('Active balance is decreased by the extra bonded amount');
        });
        describe('Request to withdraw', function() {
            it('Staked balance is decreased by the unbonded amount');
            it('Unbonding balance is increased by the unbonded amount');
            it('Locked balance remains the same by the unbonded amount');
            it('Active balance remains the same by the unbonded amount');
        });
        describe('Withdraw funds', function() {
            it('Staked balance remains the same by the withdrawn amount');
            it('Unbonding balance remains the same by the withdrawn amount');
            it('Locked balance is decreased by the withdrawn amount');
            it('Active balance is increased by the withdrawn amount');
            it('Unbonded balance is decreased by the withdrawn amount');
        });
    });
    describe('Failure cases', function() {
        describe('Stake', function() {
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
        describe('Stake more', function() {
            it('with a null sender account');
            it('with an empty sender account');
            it('with an invalid sender account');
            it('a null value');
            it('an empty value');
            it('a string as value');
            it('a negative value');
            it('more than your available balance');
        });
        describe('Request to withdraw', function() {
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
        describe('Withdraw', function() {
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