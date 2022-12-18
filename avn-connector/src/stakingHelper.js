const BN = require('bn.js');
const BN_ZERO = new BN(0);
const lambda = require('./lambdas');
const { u8aConcat, u8aToHex, hexToBn } = require('@polkadot/util');

function calculateNominatorStakingBalances(nominatorState, nominatorRequests, currentEraIndex) {
  let stakedBalance = BN_ZERO, unlockedBalance = BN_ZERO, unstakedBalance = BN_ZERO;
  nominatorRequests.forEach(req => {
    if (new BN(req.whenExecutable).gt(new BN(currentEraIndex))) {
        unstakedBalance = unstakedBalance.add(getRequestedAmount(req.action));
    } else {
        unlockedBalance = unlockedBalance.add(getRequestedAmount(req.action));
    }
  })

  stakedBalance = hexToBn(nominatorState.toJSON().total).toString();

  return {
    stakedBalance,
    unlockedBalance,
    unstakedBalance
  }
}

function calculateCollatorStakingBalances(candidateInfo, currentEra) {
  let stakedBalance = BN_ZERO, unlockedBalance = BN_ZERO, unstakedBalance = BN_ZERO;
  if (candidateInfo) {
    candidateInfo = candidateInfo.toJSON();
    stakedBalance = hexToBn(candidateInfo.totalCounted);

    if (candidateInfo.request) {
      if (new BN(candidateInfo.request.whenExecutable).gt(new BN(currentEra))) {
        unstakedBalance = hexToBn(candidateInfo.request.amount);
      } else {
        unlockedBalance = hexToBn(candidateInfo.request.amount);
      }
    }
  }

  return {
    stakedBalance,
    unlockedBalance,
    unstakedBalance
  }
}

function getRequestedAmount(requestAction) {
  if (requestAction.isDecrease === true) {
      return hexToBn(requestAction.toJSON().decrease);
  } else if(requestAction.isRevoke === true) {
      return hexToBn(requestAction.toJSON().revoke);
  }

  console.log(`Warning: Scheduled request action (${requestAction}) is not recognised. Unable to return amount`);
  return BN_ZERO;
}

function calculateStakingStats(stakersData, minUserBond, maxNominatorsRewardedPerValidator) {
  let totalStaked = new BN('0');
  let numActiveStakes = 0;
  let totalStakers = 0;
  const nominators = {};

  stakersData.info.forEach(({ exposure }) => {
    const bondTotal = exposure.total.unwrap();
    if (!bondTotal.isZero()) {
      totalStaked = totalStaked.add(bondTotal);
      numActiveStakes++;
    }

    (exposure.others || []).forEach(otherStaker => {
      const nominator = otherStaker.who.toString();
      nominators[nominator] = (nominators[nominator] || BN_ZERO).add(otherStaker.value?.toBn() || BN_ZERO);
    });
  });
  const averageStaked = totalStaked.divn(numActiveStakes).toString();
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

// Pays out all stakers and returns the last era it paid
async function payoutAllStakers(registry, logger, relayerAccount, proxyNonce, lastPayoutEra, currentEra) {
  const BN_ONE = new BN(1);
  const currentEraBN = new BN(currentEra.toString());
  const maxPayoutEraBN = currentEraBN.gt(BN_ZERO) ? currentEraBN.sub(BN_ONE) : currentEraBN;

  let lastPayoutEraBN = new BN(lastPayoutEra);
  // If we have never paid, start paying from the previous era
  lastPayoutEraBN = lastPayoutEraBN.gt(BN_ZERO) ? lastPayoutEraBN : maxPayoutEraBN;
  let proxyNonceBN = new BN(proxyNonce.toString());

  if (lastPayoutEraBN.lt(currentEraBN)) {
    let currentPayoutEraBN = new BN(lastPayoutEraBN).add(BN_ONE);

    while (currentPayoutEraBN.lte(maxPayoutEraBN)) {
      const payload = getPayoutPayload(registry, relayerAccount, currentPayoutEraBN.toString(), proxyNonceBN.toString());
      await lambda.payoutAllStakers(payload);
      currentPayoutEraBN = currentPayoutEraBN.add(BN_ONE);
      proxyNonceBN = proxyNonceBN.add(BN_ONE);
    }
  } else {
    logger.warn(`Era ${maxPayoutEraBN.toString()} has already been processed, skipping.`);
  }

  return maxPayoutEraBN.toString();
}

function getPayoutPayload(registry, relayerAccount, era, proxyNonce) {
  const payloadParams = {
    relayer: relayerAccount.address,
    user: relayerAccount.address,
    payer: relayerAccount.address,
    era,
    proxySignature: generateProxySignature(registry, relayerAccount, era, proxyNonce)
  };

  return {
    params: payloadParams
  };
}

function generateProxySignature(registry, relayerAccount, era, proxyNonce) {
  const orderedData = [
    registry.createType('Text', 'authorization for signed payout stakers operation').toU8a(false),
    registry.createType('AccountId', u8aToHex(relayerAccount.publicKey)).toU8a(true),
    registry.createType('EraIndex', era).toU8a(true),
    registry.createType('u64', proxyNonce).toU8a(true)
  ];

  const encodedDataToSign = u8aConcat(...orderedData);
  const signature = u8aToHex(relayerAccount.sign(encodedDataToSign));
  return signature;
}

module.exports = {
  calculateCollatorStakingBalances,
  calculateNominatorStakingBalances,
  calculateStakingStats,
  payoutAllStakers
};
