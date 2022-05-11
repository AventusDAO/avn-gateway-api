const BN = require('bn.js');
const BN_ZERO = new BN(0);
const lambda = require('./lambdas');

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
    totalStakers++;
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

async function payoutAllStakers(registry, logger, relayerAccount, proxyNonce, lastPayoutEra, currentEra) {
  const currentEraBN = new BN(currentEra);
  const maxPayoutEraBN = currentEraBN.sub(1);

  let lastPayoutEraBN = new BN(lastPayoutEra);
  // If we have never paid, start paying from the previous era
  lastPayoutEraBN = lastPayoutEraBN.gt(new BN(0)) ? lastPayoutEraBN : maxPayoutEraBN;

  let proxyNonceBN = new BN(proxyNonce);

  if (lastPayoutEraBN.lt(currentEraBN)) {
    let currentPayoutEraBN = new BN(lastPayoutEraBN).add(1);

    while (currentPayoutEraBN.lte(maxPayoutEraBN)) {
      const payload = getPayoutPayload(registry, relayerAccount, currentPayoutEraBN.toString(), proxyNonceBN.toString());
      await lambda.payoutAllStakers(payload);
      currentPayoutEraBN = currentPayoutEraBN.add(1);
      proxyNonceBN = proxyNonceBN.add(1);
    }
  } else {
    logger.warn(`Era ${currentEra.toString()} has already been processed, skipping.`);
  }
}

function getPayoutPayload(registry, relayerAccount, era, proxyNonce) {
  const payloadParams = {
    relayer: relayerAccount.address,
    user: relayerAccount.address,
    payer: relayerAccount.address,
    era,
    proxySignature: generateProxySignature(registry, u8aToHex(relayerAccount.publicKey), era, proxyNonce)
  };

  return {
    params: payloadParams
  }
}

function generateProxySignature(registry, relayerPublicKey, era, proxyNonce) {
  const orderedData = [
    registry.createType('Text', 'authorization for signed payout stakers operation').toU8a(false),
    registry.createType('AccountId', relayerPublicKey).toU8a(true),
    registry.createType('EraIndex', era).toU8a(true),
    registry.createType('u64', proxyNonce).toU8a(true),
  ];

  const encodedDataToSign = u8aConcat(...orderedData);
  const signature = u8aToHex(relayerAccount.sign(encodedDataToSign));
  return signature;
}

module.exports = {
  calculateBondedAmount,
  calculateUnbondingAmount,
  calculateStakingStats,
  payoutAllStakers
};
