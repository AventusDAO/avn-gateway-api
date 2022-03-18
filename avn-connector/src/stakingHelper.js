const BN = require('bn.js');
const log4js = require('log4js');
const log = log4js.getLogger();

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
  const BN_ZERO = new BN(0);

  if (!stakingInfo.unlocking) {
    return BN_ZERO;
  }

  log.info("BN_ZERO: ", BN_ZERO.toString());
  log.info(`BN_ZERO: ${BN_ZERO.toString()}`);

  log.info("Unlocking data:", JSON.stringify(stakingInfo.unlocking, null, 2));

  const filtered = stakingInfo.unlocking
    .filter(({ remainingEras, value }) => new BN(value).gt(BN_ZERO) && new BN(remainingEras).gt(BN_ZERO))
    .map(unlock => {
      log.warn("Filtered value: ", new BN(unlock.value).toString());
      return unlock.value;
    });

  const amount = filtered.reduce((total, value) => total.iadd(value), new BN(0));

  log.warn("Amount: ", amount.toString());

  return amount;
}

module.exports = {
  calculateBondedAmount,
  calculateUnbondingAmount
};
