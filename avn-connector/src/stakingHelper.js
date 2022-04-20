const BN = require('bn.js');
const BN_ZERO = new BN(0);

function calculateBondedAmount(stakingInfo) {
  let bonded = new BN(0);

  if (
    stakingInfo &&
    stakingInfo.stakingLedger &&
    stakingInfo.stakingLedger.active &&
    stakingInfo.accountId.eq(stakingInfo.stashId)
  ) {
    bonded = stakingInfo.stakingLedger.active.unwrap();
  }

  return bonded;
}

function calculateUnbondingAmount(stakingInfo) {
  if (!stakingInfo.unlocking) {
    return BN_ZERO;
  }

  const filtered = stakingInfo.unlocking
    .filter(({ remainingEras, value }) => value.gt(BN_ZERO) && remainingEras.gt(BN_ZERO))
    .map(unlock => unlock.value);

  const amount = filtered.reduce((total, value) => total.iadd(value), new BN(0));

  return amount;
}

function calculateStakingStats(stakersData, minUserBond, maxNominatorsRewardedPerValidator) {
  let totalStaked = new BN("0");
  let numActiveStakes = 0;
  let totalStakers = 0;
  const nominators = {};

  stakersData.info.forEach(({ exposure }) => {
    const bondTotal = exposure.total.unwrap();
    if (!bondTotal.isZero()) {
        totalStaked = totalStaked.add(bondTotal);
        numActiveStakes++;
    }

    (exposure.others || []).forEach((otherStaker) => {
      const nominator = otherStaker.who.toString();
      nominators[nominator] = (nominators[nominator] || BN_ZERO).add(otherStaker.value?.toBn() || BN_ZERO);
    });
  });
  const averageStaked = (totalStaked.divn(numActiveStakes)).toString();
  const minimumStaked = Object.values(nominators).reduce((minStake, value) => {
    totalStakers ++;
    return minStake.isZero() || value.lt(minStake) ? value : minStake;
  }, BN_ZERO);

  return {
    totalStaked: totalStaked.toString(),
    minimumStaked: minimumStaked.toString(),
    minUserBond: minUserBond.toString(),
    maxNominatorsRewardedPerValidator: maxNominatorsRewardedPerValidator.toString(),
    totalStakers,
    averageStaked
  };
}

module.exports = {
  calculateBondedAmount,
  calculateUnbondingAmount,
  calculateStakingStats
};
