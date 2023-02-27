const BN = require('bn.js');
const BN_ZERO = new BN(0);
const lambda = require('./lambdas');
const { u8aConcat, u8aToHex, hexToBn } = require('@polkadot/util');

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

module.exports = {
  calculateCollatorStakingBalances,
  calculateNominatorStakingBalances
};
