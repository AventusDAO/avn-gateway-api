import avn from '../avn';
import redis from '../redis';
import tier1 from '../tier1';
const config = require('multiconfig').load();
import log4js from 'log4js';
import { Contract, ethers } from 'ethers';

const log = log4js.getLogger();

const ACCOUNTS: Record<string, string | null> = {};

const LOWERING_ABI = [
  'function claimLower(bytes calldata)',
  'function checkLower(bytes calldata) external view returns (address token, uint256 amount, address recipient, uint32 lowerId, uint256 confirmationsRequired, uint256 confirmationsProvided, bool proofIsValid, bool lowerIsClaimed)'
];

const FAILURE_REASON = {
  InvalidProof: 'Invalid proof',
  AlreadyClaimed: 'Already claimed',
  RejectedByBridge: 'Rejected by bridge'
};

const RETRY_REASON = {
  InsufficientFunds: 'Insufficient funds',
  ProofCheckFailed: 'Proof check failed',
  ProofRegenerationError: 'Proof regeneration error',
  AdditionalConfirmationsRequired: 'Additional confirmations required',
  UnknownError: 'Unknown error'
};

async function autolower(): Promise<string> {
  let bridge: Contract;

  try {
    setupAccounts();
    const { avnContract } = await avn.getChainInfo();
    bridge = tier1.connectToBridge(avnContract, LOWERING_ABI, ACCOUNTS.T1!);
  } catch (error) {
    return `[Autolower] ERROR - ${error}`;
  }

  return await processLowers(bridge);
}

function setupAccounts(): void {
  ACCOUNTS.T1 = config.autolower.t1_pk === '$ENV:AUTOLOWER_T1_PK' ? null : config.autolower.t1_pk;
  ACCOUNTS.T2 = config.autolower.t2_pk === '$ENV:AUTOLOWER_T2_PK' ? null : avn.createAccount(config.autolower.t2_pk);
  if (!ACCOUNTS.T1 || !ACCOUNTS.T2) throw new Error('Account keys not configured');
}

async function processLowers(bridge: Contract): Promise<string> {
  const lockAcquired = await redis.acquireAutolowerLock(bridge.address);
  if (!lockAcquired) return '[Autolower] STATUS - Processing lowers...';

  let lowerProofs: Record<string, any>;
  try {
    lowerProofs = await getLowersToClaim(bridge);
  } catch (error) {
    await redis.releaseAutolowerLock(bridge.address);
    return `[Autolower] ERROR - Error getting lowers - ${error}`;
  }

  attemptClaims(bridge, lowerProofs); // Don't await

  const lowerIds = Object.keys(lowerProofs);
  const statusMessage = lowerIds.length ? `: ${lowerIds.join(', ')}` : '';
  return `[Autolower] STATUS - Found ${lowerIds.length} lowers to process${statusMessage}`;
}

async function getLowersToClaim(bridge: Contract): Promise<Record<string, any>> {
  let latestLowerId = await redis.getLatestAutolowerId();
  const unresolvedLowerIds = await redis.getAutolowers();
  const lowerProofs = await avn.getUnclaimedLowerProofs(latestLowerId, unresolvedLowerIds);

  const checkFromT1Block = await redis.getAutolowerNextT1Block();
  const [checkedToT1Block, recentClaims] = await tier1.getLowersClaimedSinceBlock(bridge.address, checkFromT1Block);

  for (const lowerId of recentClaims) {
    await redis.removeAutolower(lowerId);
    delete lowerProofs[lowerId];
    latestLowerId = Math.max(latestLowerId, lowerId);
  }

  for (const lowerId of Object.keys(lowerProofs)) {
    await redis.addAutolower(Number(lowerId));
  }

  await redis.setLatestAutolowerId(latestLowerId);
  await redis.setAutolowerNextT1Block(checkedToT1Block + 1);
  return lowerProofs;
}

async function attemptClaims(bridge: Contract, lowerProofs: Record<string, any>): Promise<void> {
  const numLowers = Object.keys(lowerProofs).length;
  if (numLowers === 0) {
    await redis.releaseAutolowerLock(bridge.address);
    return;
  }

  for (const [id, proof] of Object.entries(lowerProofs)) {
    await redis.refreshAutolowerLock(bridge.address);
    if (await proofChecksPass(bridge, id, proof)) {
      await attemptClaim(bridge, id, proof);
    }
  }

  await redis.releaseAutolowerLock(bridge.address);
  log.info(`[Autolower] STATUS - Finished processing ${numLowers} lowers`);
}

async function proofChecksPass(bridge: Contract, id: string, proof: any): Promise<boolean> {
  try {
    const check = await bridge.checkLower(proof);
    return await handleProofCheckResult(check, id, proof);
  } catch (error: any) {
    if (error.code && error.code === 'INVALID_ARGUMENT') {
      await closeFailedClaim(FAILURE_REASON.InvalidProof, id, proof);
    } else {
      retryClaim(RETRY_REASON.ProofCheckFailed, id, proof, error);
    }
    return false;
  }
}

async function handleProofCheckResult(check: any, id: string, proof: any): Promise<boolean> {
  if (check.lowerIsClaimed) {
    await closeFailedClaim(FAILURE_REASON.AlreadyClaimed, id, proof);
    return false;
  }

  if (!check.proofIsValid) {
    if (check.confirmationsRequired > check.confirmationsProvided) {
      await regenerateProofAndRetryClaim(RETRY_REASON.AdditionalConfirmationsRequired, id, proof);
    } else {
      await closeFailedClaim(FAILURE_REASON.InvalidProof, id, proof);
    }
    return false;
  }

  return true;
}

async function attemptClaim(bridge: Contract, id: string, proof: any): Promise<void> {
  try {
    const tx = await bridge.claimLower(proof);
    await handleClaimTransaction(tx, id);
  } catch (error) {
    await handleClaimError(error, id, proof, bridge);
  }
}

async function handleClaimTransaction(tx: ethers.ContractTransaction, id: string): Promise<void> {
  const receipt = await tx.wait();
  if (receipt.status === 0) {
    await closeFailedClaim(FAILURE_REASON.RejectedByBridge, id, tx.hash);
  } else {
    await closeSuccessfulClaim(id, tx.hash);
  }
}

async function handleClaimError(error: any, id: string, proof: any, bridge: Contract): Promise<void> {
  switch (error.code) {
    case 'INSUFFICIENT_FUNDS':
      retryClaim(RETRY_REASON.InsufficientFunds, id, proof);
      break;
    case 'INVALID_ARGUMENT':
      await closeFailedClaim(FAILURE_REASON.InvalidProof, id, proof);
      break;
    case 'UNPREDICTABLE_GAS_LIMIT':
      await recheckProofToResolve(id, proof, bridge);
      break;
    default:
      retryClaim(RETRY_REASON.UnknownError, id, proof, error);
  }
}

async function recheckProofToResolve(id: string, proof: any, bridge: Contract): Promise<void> {
  try {
    const check = await bridge.checkLower(proof);

    if (check.lowerIsClaimed) {
      await closeFailedClaim(FAILURE_REASON.AlreadyClaimed, id, proof);
    } else if (check.proofIsValid) {
      retryClaim(RETRY_REASON.InsufficientFunds, id, proof);
    } else if (check.confirmationsRequired > check.confirmationsProvided) {
      await regenerateProofAndRetryClaim(RETRY_REASON.AdditionalConfirmationsRequired, id, proof);
    } else {
      await closeFailedClaim(FAILURE_REASON.InvalidProof, id, proof);
    }
  } catch (error) {
    retryClaim(RETRY_REASON.ProofCheckFailed, id, proof, error);
  }
}

async function closeFailedClaim(reason: string, id: string, info: any): Promise<void> {
  await redis.removeAutolower(Number(id));
  log.info(`[Autolower] CLAIM FAILED - Lower ID: ${id}, reason: ${reason}, info: ${info}`);
}

async function closeSuccessfulClaim(id: string, txHash: string): Promise<void> {
  await redis.removeAutolower(Number(id));
  log.info(`[Autolower] CLAIM SUCCEEDED - Lower ID: ${id}, tx hash: ${txHash}`);
}

function retryClaim(reason: string, id: string, proof: any, error: any = ''): void {
  log.info(`[Autolower] CLAIM WILL BE RETRIED - Lower ID: ${id}, reason: ${reason}, proof: ${proof}, error: ${error}`);
}

async function regenerateProofAndRetryClaim(reason: string, id: string, proof: any): Promise<void> {
  try {
    await avn.regenerateLowerProof(ACCOUNTS.T2!, Number(id));
    log.info(`[Autolower] CLAIM WILL BE RETRIED WITH NEW PROOF - Lower ID: ${id}, reason: ${reason}`);
  } catch (error) {
    retryClaim(RETRY_REASON.ProofRegenerationError, id, proof, error);
  }
}

const autolowering = { autolower };
export default autolowering;
