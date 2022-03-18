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

  log.info("BN_ZERO: ", BN_ZERO.toString());
  log.info(`BN_ZERO: ${BN_ZERO.toString()}`);

  log.info("\nUnlocking data:", JSON.stringify(stakingInfo.unlocking, null, 2));

  const filtered = stakingInfo.unlocking
    .filter(({ remainingEras, value }) => {
      log.warn(`value: ${new BN(value).toString()}`);
      log.warn(`remainingEras: ${new BN(remainingEras).toString()}`);

      log.warn(`value.gt(BN_ZERO): ${value.gt(BN_ZERO)}`);
      log.warn(`remainingEras.gt(BN_ZERO): ${remainingEras.gt(BN_ZERO)}`);

      log.warn(`value.gt(BN_ZERO): ${new BN(value).gt(BN_ZERO)}`);
      log.warn(`remainingEras.gt(BN_ZERO): ${new BN(remainingEras).gt(BN_ZERO)}`);

      return new BN(value).gt(BN_ZERO) && new BN(remainingEras).gt(BN_ZERO);
    })
    .map(unlock => {
      log.warn("Value: ", new BN(unlock.value).toString());
      return unlock.value;
    });

  log.warn("filtered JSON: ", JSON.stringify(filtered));
  log.warn(`filtered String: ${JSON.stringify(filtered)}`);
  log.warn(`filtered raw: `, filtered);
  log.warn(`filtered raw: ${filtered}`);

  const amount = filtered.reduce((total, value) => {
    log.warn(` [reducer] - value: ${value}`);
    log.warn(` [reducer] - total: ${total}`);
    return total.iadd(value), BN_ZERO;
  });

  log.warn("\n\nAmount: ", amount.toString());

  return amount;
}

module.exports = {
  calculateBondedAmount,
  calculateUnbondingAmount
};
