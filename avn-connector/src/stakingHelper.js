const BN = require('bn.js');
const BN_ZERO = new BN(0);
const log4js = require('log4js');
const log = log4js.getLogger();

function calculateBondedAmount(stakingInfo) {
  let bonded = BN_ZERO;

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

  log.info("Unlocking data:", JSON.stringify(stakingInfo.unlocking, null, 2));
  const filtered = stakingInfo.unlocking
    .filter(({ remainingEras, value }) => value.gt(BN_ZERO) && remainingEras.gt(BN_ZERO))
    .map(unlock => {
      log.info("Value: ", new BN(unlock.value).toString());
      return unlock.value;
    });

  const amount = filtered.reduce((total, value) => total.iadd(value), BN_ZERO);
  log.info("Amount: ", amount);

  return amount;
}

module.exports = {
  calculateBondedAmount,
  calculateUnbondingAmount
};
