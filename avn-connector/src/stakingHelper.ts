import BN from 'bn.js';
import { u8aConcat, u8aToHex, hexToBn } from '@polkadot/util';
import lambda from './lambdas';
import logger from './logger';
import { Option } from '@polkadot/types';

const BN_ZERO = new BN(0);

interface RequestAction {
  isDecrease: boolean;
  isRevoke: boolean;
  toJSON: () => { decrease?: string; revoke?: string };
}

interface NominatorRequest {
  whenExecutable: string;
  action: RequestAction;
}

interface StakingBalances {
  stakedBalance: BN;
  unlockedBalance: BN;
  unstakedBalance: BN;
}

function calculateNominatorStakingBalances(
  nominatorState: Option<any>,
  nominatorRequests: NominatorRequest[],
  currentEraIndex: number
): StakingBalances {
  let stakedBalance = BN_ZERO.clone(),
    unlockedBalance = BN_ZERO.clone(),
    unstakedBalance = BN_ZERO.clone();

  const nominatorStateValue = nominatorState.unwrapOr(null);
  if (nominatorStateValue && !nominatorState.isEmpty) {
    stakedBalance = hexToBn(nominatorStateValue.toJSON().total);
  }

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

function calculateCollatorStakingBalances(
  candidateInfo: Option<any>,
  currentEra: number
): StakingBalances {
  let stakedBalance = BN_ZERO.clone(),
    unlockedBalance = BN_ZERO.clone(),
    unstakedBalance = BN_ZERO.clone();

  const candidateInfoValue = candidateInfo.unwrapOr(null);
  if (candidateInfoValue && !candidateInfo.isEmpty) {
    const info = candidateInfoValue.toJSON();
    stakedBalance = hexToBn(info.bond);

    if (info.request) {
      if (new BN(info.request.whenExecutable).gt(new BN(currentEra))) {
        unstakedBalance = hexToBn(info.request.amount);
      } else {
        unlockedBalance = hexToBn(info.request.amount);
      }
    }
  }

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

  logger.warn(
    `Warning: Scheduled request action (${requestAction}) is not recognized. Unable to return amount`
  );
  return BN_ZERO;
}

const stakingHelper = {
  calculateCollatorStakingBalances,
  calculateNominatorStakingBalances
};
export default stakingHelper;
