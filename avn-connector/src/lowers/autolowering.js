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

const REGENERATE_PROOF_REASON = {
  TooFewConfirmations: 'Too few confirmations'
};

const autolowerAccount = getAutolowerAccount();

function getAutolowerAccount() {
  const pk = config.autolower?.pk;
  return pk && pk !== '$ENV:AUTOLOWER_PK' ? pk : null;
}

async function autolower() {
  if (!autolowerAccount) {
    return 'No autolower account set';
  }

  try {
    const { avnContract } = await avn.getChainInfo();
    const bridge = tier1.connectToBridge(avnContract, LOWERING_ABI, autolowerAccount);
    return await processLowers(bridge);
  } catch (error) {
    logError(error);
    return `Error in autolower: ${error}`;
  }
}

async function processLowers(bridge) {
  if (await redis.accquireAutolowerLock(bridge.address)) {
    return 'Existing claims are still being processed';
  }

  const unclaimedLowerProofs = await getUnclaimedLowers(bridge);
  claimLowers(bridge, unclaimedLowerProofs); // Don't await, let these run in the background
  const unclaimedKeys = Object.keys(unclaimedLowerProofs);
  let resultString = `New lowers to claim: ${unclaimedKeys.length}`;
  resultString += unclaimedKeys.length > 0 ? ` Claiming: ${unclaimedKeys.join(', ')}` : '';
  return resultString;
}

async function getUnclaimedLowers(bridge) {
  let latestClaimedLowerId = await redis.getAutolowerLatestClaimedLowerId();
  const lowerIdsToRetry = await redis.getAutolowersToRetry();
  const unclaimedLowerProofs = await avn.getUnclaimedLowerProofs(latestClaimedLowerId, lowerIdsToRetry);
  const fromBlock = (await redis.getAutolowerLastT1BlockChecked()) + 1;
  const [lastBlockChecked, claimedLowerIds] = await tier1.getLowersClaimedSinceBlock(bridge.address, fromBlock);
  claimedLowerIds.forEach(lowerId => {
    delete unclaimedLowerProofs[lowerId];
    latestClaimedLowerId = Math.max(latestClaimedLowerId, lowerId);
  });
  await redis.setAutolowerLatestClaimedLowerId(latestClaimedLowerId);
  await redis.setAutolowerLastT1BlockChecked(lastBlockChecked);
  return unclaimedLowerProofs;
}

async function claimLowers(bridge, lowerProofs) {
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
      logError(error);
      await retryClaim(RETRY_REASON.ProofCheckFailed, id, proof);
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
      await regenerateProofAndRetryLower(REGENERATE_PROOF_REASON.TooFewConfirmations, id, proof);
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
      logError(error);
      await retryClaim(RETRY_REASON.UnknownError, id, proof);
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
      await regenerateProofAndRetryLower(REGENERATE_PROOF_REASON.TooFewConfirmations, id, proof);
    } else {
      closeFailedClaim(FAILURE_REASON.InvalidProof, id, proof);
    }
  } catch (error) {
    logError(error);
    await retryClaim(RETRY_REASON.ProofcheckFailed, id, proof);
  }
}

function closeFailedClaim(reason, id, info) {
  log.info(`[Autolower] FAILED - ${reason}. Lower ID: ${id}, ${info}`);
}

function closeSuccessfulClaim(id, txHash) {
  log.info(`[Autolower] SUCCEEDED - Lower ID: ${id}, tx hash: ${txHash}`);
}

async function retryClaim(reason, id, proof) {
  log.info(`[Autolower] RETRY - ${reason}. Lower ID: ${id}, proof: ${proof}`);
  await redis.addAutolowerToRetry(id);
}

async function regenerateProofAndRetryLower(reason, id, proof) {
  try {
    log.info(`[Autolower] REGENERATE PROOF - ${reason}. Lower ID: ${id}`);
    await avn.regenerateLowerProof(id);
    await redis.addAutolowerToRetry(id);
  } catch (error) {
    logError(error);
    await retryClaim(RETRY_REASON.ProofRegenerationError, id, proof);
  }
}

function logError(error) {
  log.error('[Autolower] Error -', error);
}

module.exports = { autolower };
