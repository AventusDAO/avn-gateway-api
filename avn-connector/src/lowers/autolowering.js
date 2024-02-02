const avn = require('../avn');
const redis = require('../redis');
const tier1 = require('../tier1');
const config = require('multiconfig').load();
const log4js = require('log4js');
const log = log4js.getLogger();

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
  AdditionalConfirmationsRequired: 'Needs more confirmations',
  UnknownError: 'Unknown error'
};

const autolowerAccount = getAutolowerAccount();

function getAutolowerAccount() {
  const pk = config.autolower?.pk;
  return pk && pk !== '$ENV:AUTOLOWER_PK' ? pk : null;
}

async function autolower() {
  if (!autolowerAccount) {
    return '[Autolower] ERROR - No account specified';
  }

  let bridge;

  try {
    const { avnContract } = await avn.getChainInfo();
    bridge = await tier1.connectToBridge(avnContract, LOWERING_ABI, autolowerAccount);
  } catch (error) {
    return `[Autolower] ERROR - Cannot connect to bridge - ${error}`;
  }

  return await processLowers(bridge);
}

async function processLowers(bridge) {
  const lockAcquired = await redis.acquireAutolowerLock(bridge.address);
  if (!lockAcquired) return '[Autolower] STATUS - Still processing lowers...';

  let proofs;
  try {
    proofs = await getLowersToProcess(bridge);
  } catch (error) {
    await redis.releaseAutolowerLock(bridge.address);
    return `[Autolower] ERROR - Error getting lowers - ${error}`;
  }

  attemptClaims(bridge, proofs); // Don't await

  const lowerIds = Object.keys(proofs);
  const statusMessage = lowerIds.length ? `: ${lowerIds.join(', ')}` : '';
  return `[Autolower] STATUS - Found ${lowerIds.length} lowers to process${statusMessage}`;
}

async function getLowersToProcess(bridge) {
  let latestLowerId = await redis.getAutolowerLatestId();
  const existingAutolowers = await redis.getAutolowers();
  const proofs = await avn.getLowerProofs(latestLowerId, existingAutolowers);

  const checkFromT1Block = await redis.getAutolowerNextT1Block();
  const [checkedToT1Block, claimedLowers] = await tier1.getLowersClaimedSinceBlock(bridge.address, checkFromT1Block);

  // Remove any recently claimed lowers
  for (const lowerId of claimedLowers) {
    delete proofs[lowerId];
    await redis.removeAutolower(lowerId);
    latestLowerId = Math.max(latestLowerId, lowerId);
  }

  // Add any new lowers
  for (const lowerId of Object.keys(proofs)) {
    await redis.addAutolower(lowerId);
  }

  await redis.setAutolowerLatestId(latestLowerId);
  await redis.setAutolowerNextT1Block(checkedToT1Block + 1);
  return proofs;
}

async function attemptClaims(bridge, proofs) {
  if (Object.keys(proofs).length === 0) {
    return await redis.releaseAutolowerLock(bridge.address);
  }

  for (const [id, proof] of Object.entries(proofs)) {
    await redis.refreshAutolowerLock(bridge.address);
    if (await proofChecksPass(bridge, id, proof)) {
      await attemptClaim(bridge, id, proof);
    }
  }

  await redis.releaseAutolowerLock(bridge.address);
  log.info(`[Autolower] STATUS - Finished processing ${numLowers} lowers`);
}

async function proofChecksPass(bridge, id, proof) {
  try {
    const check = await bridge.checkLower(proof);
    return await handleProofCheckResult(check, id, proof);
  } catch (error) {
    if (error.code && error.code === 'INVALID_ARGUMENT') {
      await closeFailedClaim(FAILURE_REASON.InvalidProof, id, proof);
    } else {
      retryClaim(RETRY_REASON.ProofCheckFailed, id, proof, error);
    }
    return false;
  }
}

async function handleProofCheckResult(check, id, proof) {
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

async function attemptClaim(bridge, id, proof) {
  try {
    const tx = await bridge.claimLower(proof);
    await handleClaimTransaction(tx, id);
  } catch (error) {
    await handleClaimError(error, id, proof, bridge);
  }
}

async function handleClaimTransaction(tx, id) {
  const receipt = await tx.wait();
  if (receipt.status === 0) {
    await closeFailedClaim(FAILURE_REASON.RejectedByBridge, id, tx.hash);
  } else {
    await closeSuccessfulClaim(id, tx.hash);
  }
}

async function handleClaimError(error, id, proof, bridge) {
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

async function recheckProofToResolve(id, proof, bridge) {
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
    retryClaim(RETRY_REASON.ProofcheckFailed, id, proof, error);
  }
}

async function closeFailedClaim(reason, id, info) {
  await redis.removeAutolower(id);
  log.info(`[Autolower] CLAIM FAILED - Lower ID: ${id}, reason: ${reason}, info: ${info}`);
}

async function closeSuccessfulClaim(id, txHash) {
  await redis.removeAutolower(id);
  log.info(`[Autolower] CLAIM SUCCEEDED - Lower ID: ${id}, tx hash: ${txHash}`);
}

function retryClaim(reason, id, proof, error = '') {
  log.info(`[Autolower] CLAIM WILL BE RETRIED - ${reason}. Lower ID: ${id}, proof: ${proof}, error: ${error}`);
}

async function regenerateProofAndRetryClaim(reason, id, proof) {
  try {
    log.info(`[Autolower] CLAIM WILL BE RETRIED WITH NEW PROOF - Lower ID: ${id}, reason: ${reason}`);
    await avn.regenerateLowerProof(id);
  } catch (error) {
    retryClaim(RETRY_REASON.ProofRegenerationError, id, proof, error);
  }
}

module.exports = { autolower };
