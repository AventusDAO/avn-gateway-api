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
  NetworkError: 'Network error',
  ProofRegenerationError: 'Proof regeneration error',
  UnknownError: 'Unknown error'
};

const REGENERATE_REASON = {
  NeedsMoreConfirmations: 'Needs more confirmations'
};

const autolowerAccount = getAutolowerAccount();

function getAutolowerAccount() {
  const pk = config.autolower?.pk;
  return pk && pk !== '$ENV:AUTOLOWER_PK' ? pk : null;
}

async function autolower() {
  if (!autolowerAccount) {
    return '`[Autolower] STATUS - No account specified';
  }

  try {
    const { avnContract } = await avn.getChainInfo();
    const bridge = await tier1.connectToBridge(avnContract, LOWERING_ABI, autolowerAccount);
  } catch (error) {
    return `[Autolower] STATUS - Cannot connect to bridge - ${error}`;
  }

  return await processLowerClaims(bridge);
}

async function processLowerClaims(bridge) {
  const lockAccquired = await redis.accquireAutolowerLock(bridge.address);
  if (!lockAccquired) {
    return '[Autolower] STATUS - Still processing existing lowers...';
  }

  const lowerProofs = await getLowersToClaim(bridge);
  claimLowersInBackground(bridge, lowerProofs);

  const lowerIds = Object.keys(lowerProofs);
  let resultString = `[Autolower] STATUS - ${lowerIds.length} lowers found to process`;
  return resultString += lowerIds.length > 0 ? `IDs: ${lowerIds.join(', ')}` : '';
}

async function getLowersToClaim(bridge) {
  let highestClaimedLowerId = await redis.getAutolowerHighestClaimedLowerId();
  const lowerIdsToRetry = await redis.getAutolowersToRetry();
  const lowerProofs = await avn.getLowerProofs(highestClaimedLowerId, lowerIdsToRetry);

  const lastT2BlockChecked = await redis.getAutolowerLastT1BlockChecked();
  const [lastT1BlockChecked, claimedLowerIds] = await tier1.getLowersClaimedSinceBlock(bridge.address, lastT2BlockChecked + 1);

  claimedLowerIds.forEach(id => {
    delete lowerProofs[id];
    highestClaimedLowerId = Math.max(highestClaimedLowerId, id);
  });

  await redis.setAutolowerHighestClaimedLowerId(highestClaimedLowerId);
  await redis.setAutolowerLastT1BlockChecked(lastT1BlockChecked);
  return lowerProofs;
}

function claimLowersInBackground(bridge, lowerProofs) {
  claimLowers(bridge, lowerProofs);
}

async function claimLowersInBackground(bridge, lowerProofs) {
  if (Object.keys(lowerProofs).length === 0) {
    return await redis.releaseAutolowerLock(bridge.address);
  }

  for (const [id, proof] of Object.entries(lowerProofs)) {
    await redis.refreshAutolowerLock(bridge.address);
    if (await proofChecksPass(bridge, id, proof)) {
      await claimLower(bridge, id, proof);
    }
  }

  await redis.releaseAutolowerLock(bridge.address);
}

async function proofChecksPass(bridge, id, proof) {
  try {
    const check = await bridge.checkLower(proof);
    return await handleProofCheckResult(check, id, proof);
  } catch (error) {
    if (error.code && error.code === 'INVALID_ARGUMENT') {
      closeFailedClaim(FAILURE_REASON.InvalidProof, id, proof);
    } else {
      await retryClaim(RETRY_REASON.ProofCheckFailed, id, proof, error);
    }
    return false;
  }
}

async function handleProofCheckResult(check, id, proof) {
  if (check.lowerIsClaimed) {
    closeFailedClaim(FAILURE_REASON.AlreadyClaimed, id, proof);
    return false;
  }

  if (!check.proofIsValid) {
    if (check.confirmationsRequired > check.confirmationsProvided) {
      await regenerateProofAndRetryLower(REGENERATE_REASON.NeedsMoreConfirmations, id, proof);
    } else {
      closeFailedClaim(FAILURE_REASON.InvalidProof, id, proof);
    }
    return false;
  }

  return true;
}

async function claimLower(bridge, id, proof) {
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
    closeFailedClaim(FAILURE_REASON.RejectedByBridge, id, tx.hash);
  } else {
    closeSuccessfulClaim(id, tx.hash);
  }
}

async function handleClaimError(error, id, proof, bridge) {
  switch (error.code) {
    case 'INSUFFICIENT_FUNDS':
      await retryClaim(RETRY_REASON.InsufficientFunds, id, proof);
      break;
    case 'INVALID_ARGUMENT':
      closeFailedClaim(FAILURE_REASON.InvalidProof, id, proof);
      break;
    case 'UNPREDICTABLE_GAS_LIMIT':
      await recheckProofToResolve(id, proof, bridge);
      break;
    default:
      await retryClaim(RETRY_REASON.UnknownError, id, proof, error);
  }
}

async function recheckProofToResolve(id, proof, bridge) {
  try {
    const check = await bridge.checkLower(proof);

    if (check.lowerIsClaimed) {
      closeFailedClaim(FAILURE_REASON.AlreadyClaimed, id, proof);
    } else if (check.proofIsValid) {
      await retryClaim(RETRY_REASON.NetworkError, id, proof);
    } else if (check.confirmationsRequired > check.confirmationsProvided) {
      await regenerateProofAndRetryLower(REGENERATE_REASON.NeedsMoreConfirmations, id, proof);
    } else {
      closeFailedClaim(FAILURE_REASON.InvalidProof, id, proof);
    }
  } catch (error) {
    await retryClaim(RETRY_REASON.ProofcheckFailed, id, proof, error);
  }
}

function closeFailedClaim(reason, id, info) {
  log.info(`[Autolower] CLAIM FAILED - Lower ID: ${id}, reason: ${reason}. ${info}`);
}

function closeSuccessfulClaim(id, txHash) {
  log.info(`[Autolower] CLAIM SUCCEEDED - Lower ID: ${id}, tx hash: ${txHash}`);
}

async function retryClaim(reason, id, proof, error = '') {
  log.info(`[Autolower] CLAIM TO RETRY - ${reason}. Lower ID: ${id}, proof: ${proof} error: ${error}`);
  await redis.addAutolowerToRetry(id);
}

async function regenerateProofAndRetryLower(reason, id, proof) {
  try {
    log.info(`[Autolower] CLAIM TO RETRY WITH NEW PROOF - Lower ID: ${id}, reason ${reason}`);
    await avn.regenerateLowerProof(id);
    await redis.addAutolowerToRetry(id);
  } catch (error) {
    await retryClaim(RETRY_REASON.ProofRegenerationError, id, proof, error);
  }
}

module.exports = { autolower };
