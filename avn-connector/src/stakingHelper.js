const BN = require('bn.js');
const BN_ZERO = new BN(0);

function calculateBondedAmount (stakingInfo) {
  let bonded = BN_ZERO;

  if (stakingInfo && stakingInfo.stakingLedger && stakingInfo.stakingLedger.active && stakingInfo.accountId.eq(stakingInfo.stashId)) {
      bonded = stakingInfo.stakingLedger.active.unwrap();
  }

  return bonded;
}

function calculateUnbondingAmount (stakingInfo) {
  if (!stakingInfo.unlocking) {
    return BN_ZERO;
  }

  const filtered = stakingInfo.unlocking
      .filter(({ remainingEras, value }) => value.gt(BN_ZERO) && remainingEras.gt(BN_ZERO))
      .map((unlock) => unlock.value);

  return filtered.reduce((total, value) => total.iadd(value), BN_ZERO);
}

module.exports = {
  calculateBondedAmount,
  calculateUnbondingAmount
};
