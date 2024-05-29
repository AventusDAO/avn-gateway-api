import BN from 'bn.js';
// import BN = require('bn.js');
import { u8aConcat, u8aToHex, hexToBn } from '@polkadot/util';
import lambda from './lambdas';
import logger from './logger';

const BN_ZERO = new BN(0);

interface NominatorState {
  total: string
}

interface NominatorStateResponse {
  isEmpty: boolean;
  toJSON: () => { total: string };
}

interface RequestAction {
  isDecrease: boolean;
  isRevoke: boolean;
  toJSON: () => { decrease?: string; revoke?: string };
}

interface NominatorRequest {
  whenExecutable: string;
  action: RequestAction;
}

export interface CandidateInfo {
  bond: string;
  request?: {
      whenExecutable: string;
      amount: string
  }
}

export interface CandidateInfoResponse {
  isEmpty: boolean;
  toJSON: () => CandidateInfo;
}

interface StakingBalances {
  stakedBalance: BN;
  unlockedBalance: BN;
  unstakedBalance: BN;
}

function calculateNominatorStakingBalances(nominatorState: NominatorState, nominatorRequests: NominatorRequest[], currentEraIndex: string): StakingBalances {
  let stakedBalance = BN_ZERO.clone(),
    unlockedBalance = BN_ZERO.clone(),
    unstakedBalance = BN_ZERO.clone();

  // if (!nominatorState.isEmpty) {
    // stakedBalance = hexToBn(nominatorState.toJSON().total);
  // }

  stakedBalance = hexToBn(nominatorState.total);

  nominatorRequests.forEach(req => {
    if (new BN(req.whenExecutable).gt(new BN(currentEraIndex))) {
      unstakedBalance = unstakedBalance.add(getRequestedAmount(req.action));
    } else {
      unlockedBalance = unlockedBalance.add(getRequestedAmount(req.action));
    }
  });

  return {
    stakedBalance,
    unlockedBalance,
    unstakedBalance
  };
}

function calculateCollatorStakingBalances(candidateInfo: CandidateInfo, currentEra: number): StakingBalances {
  let stakedBalance = BN_ZERO.clone(),
    unlockedBalance = BN_ZERO.clone(),
    unstakedBalance = BN_ZERO.clone();

  // if (!candidateInfo.isEmpty) {
    // const info = candidateInfo.toJSON();
    stakedBalance = hexToBn(candidateInfo.bond);

    if (candidateInfo.request) {
      if (new BN(candidateInfo.request.whenExecutable).gt(new BN(currentEra))) {
        unstakedBalance = hexToBn(candidateInfo.request.amount);
      } else {
        unlockedBalance = hexToBn(candidateInfo.request.amount);
      }
    }
  // }

  return {
    stakedBalance,
    unlockedBalance,
    unstakedBalance
  };
}

function getRequestedAmount(requestAction: RequestAction): BN {
  if (requestAction.isDecrease) {
    return hexToBn(requestAction.toJSON().decrease!);
  } else if (requestAction.isRevoke) {
    return hexToBn(requestAction.toJSON().revoke!);
  }

  logger.warn(`Warning: Scheduled request action (${requestAction}) is not recognized. Unable to return amount`);
  return BN_ZERO;
}

const stakingHelper = {
  calculateCollatorStakingBalances,
  calculateNominatorStakingBalances
};
export default stakingHelper;
