describe('staking', async () => {
    describe('Successful cases', function() {
        describe('Stake', function() {
            it('Staked balance is increased with the amount bonded');
            it('Locked balance is increased with the amount bonded');
            it('Active balance is decreased with the amount bonded');
        });
        describe('Stake more', function() {
            it('Staked balance is increased with the extra amount bonded');
            it('Locked balance is increased with the extra amount bonded');
            it('Active balance is decreased with the extra amount bonded');
        });
        describe('Request to withdraw', function() {
            it('Staked balance is decreased with the amount unbonded');
            it('Unbonding balance is increased with the amount unbonded');
            it('Locked balance remains the same with the amount unbonded');
            it('Active balance remains the same with the amount unbonded');
        });
        describe('Withdraw funds', function() {
            it('Staked balance remains the same with the amount withdrawn');
            it('Unbonding balance remains the same with the amount withdrawn');
            it('Locked balance is decreased with the amount withdrawn');
            it('Active balance is increased with the amount withdrawn');
            it('Unbonded balance is decreased with the amount withdrawn');
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