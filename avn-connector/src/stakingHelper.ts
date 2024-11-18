import BN from 'bn.js';
import logger from './logger';
import { Option } from '@polkadot/types';
import { hexToBn } from '@polkadot/util';

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

function asBN(hexValue: string){
  const bnValue = hexToBn(hexValue).toString()
  return new BN(bnValue)
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
    const totalNominatorStateHex = nominatorStateValue.toJSON().total
    stakedBalance = asBN(totalNominatorStateHex)
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
    stakedBalance = new BN(info.bond);

    if (info.request) {
      if (new BN(info.request.whenExecutable).gt(new BN(currentEra))) {
        unstakedBalance = asBN(info.request.amount);
      } else {
        unlockedBalance = asBN(info.request.amount);
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
    return asBN(requestAction.toJSON().decrease!);
  } else if (requestAction.isRevoke) {
    return asBN(requestAction.toJSON().revoke!);
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
