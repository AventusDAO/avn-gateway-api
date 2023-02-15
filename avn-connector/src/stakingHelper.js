const BN = require('bn.js');
const BN_ZERO = new BN(0);
const lambda = require('./lambdas');
const { u8aConcat, u8aToHex, hexToBn } = require('@polkadot/util');
const log4js = require('log4js');
const log = log4js.getLogger();

function calculateNominatorStakingBalances(nominatorState, nominatorRequests, currentEraIndex) {
  let stakedBalance = BN_ZERO, unlockedBalance = BN_ZERO, unstakedBalance = BN_ZERO;

  if (nominatorState.isEmpty === false) {
    stakedBalance = hexToBn(nominatorState.toJSON().total).toString();
  }

  nominatorRequests.forEach(req => {
    if (new BN(req.whenExecutable).gt(new BN(currentEraIndex))) {
        unstakedBalance = unstakedBalance.add(getRequestedAmount(req.action));
    } else {
        unlockedBalance = unlockedBalance.add(getRequestedAmount(req.action));
    }
  })

  return {
    stakedBalance,
    unlockedBalance,
    unstakedBalance
  }
}

function calculateCollatorStakingBalances(candidateInfo, currentEra) {
  let stakedBalance = BN_ZERO, unlockedBalance = BN_ZERO, unstakedBalance = BN_ZERO;
  if (candidateInfo.isEmpty === false) {
    candidateInfo = candidateInfo.toJSON();
    stakedBalance = hexToBn(candidateInfo.bond);

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

function calculateStakingStats(stakersData, minUserBond, maxNominatorsRewardedPerValidator, totalStaked) {
  // let totalStaked = new BN('0');
  let numActiveStakes = stakersData.length;
  let totalStakers = 0;
  const nominators = {};

  stakersData.forEach( stake => {
    log.trace({ message: 'stake', stake: `${JSON.stringify(stake)}` });


    log.trace({ message: 'stake[1]', stake_one: `${JSON.stringify(stake[1])}` });

    const nominator = stake[1].id.toString();
    nominators[nominator] = stake[1]?.total?.toBn() || BN_ZERO;
  });
  // stakersData.info.forEach(({ exposure }) => {
  //   const bondTotal = exposure.total.unwrap();
  //   if (!bondTotal.isZero()) {
  //     totalStaked = totalStaked.add(bondTotal);
  //     numActiveStakes++;
  //   }

  //   (exposure.others || []).forEach(otherStaker => {
  //     const nominator = otherStaker.who.toString();
  //     nominators[nominator] = (nominators[nominator] || BN_ZERO).add(otherStaker.value?.toBn() || BN_ZERO);
  //   });
  // });

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

module.exports = {
  calculateCollatorStakingBalances,
  calculateNominatorStakingBalances,
  calculateStakingStats
};
