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

function calculateStakingStats(stakersData) {
  let totalStaked = new BN("0");
  let numActiveStakes = 0;

  stakersData.info.forEach(({ exposure }) => {
    const bondTotal = exposure.total.unwrap();
    if (!bondTotal.isZero()) {
        totalStaked = totalStaked.add(bondTotal);
        numActiveStakes++;
    }
  });
  const averageStaked = (totalStaked.divn(numActiveStakes)).toString();

  return {
    totalStaked: totalStaked.toString(),
    averageStaked
  };
}

module.exports = {
  calculateBondedAmount,
  calculateUnbondingAmount,
  calculateStakingStats
};
