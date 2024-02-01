const utils = require('./utils');
const avn = require('../avn');
const redis = require('../redis');
const tier1 = require('../tier1');
const log4js = require('log4js');
const log = log4js.getLogger();

const LOWERING_ABI = [
  'function claimLower(bytes calldata)',
  'function checkLower(bytes calldata) external view returns (address token, uint256 amount, address recipient, uint32 lowerId, uint256 confirmationsRequired, uint256 confirmationsProvided, bool proofIsValid, bool lowerIsClaimed)'
];

const autolowerAccount = getAutolowerAccount();

function getAutolowerAccount() {
  return config.autolower?.pk !== '$ENV:AUTOLOWER_PK' ? config.autolower.pk : null;
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
    return `Error in autolower: ${error}`;
  }
}

async function processLowers(bridge) {
  if (await redis.accquireAutolowerLock(bridge.address)) {
    return 'Existing claims are still being processed';
  }

  let latestClaimedLowerId = await redis.getAutolowerLatestClaimedLowerId();
  const unclaimedLowerProofs = await avn.getUnclaimedLowerProofs(latestClaimedLowerId);
  const fromBlock = (await redis.getAutolowerLastT1BlockChecked()) + 1;
  const [lastBlockChecked, claimedLowerIds] = await tier1.getLowersClaimedSinceBlock(bridge.address, fromBlock);
  await updateClaimedLowers(claimedLowerIds, unclaimedLowerProofs, latestClaimedLowerId);

  claimLowers(bridge, unclaimedLowerProofs); // Don't await, let these run in the background

  const unclaimedKeys = Object.keys(unclaimedLowerProofs);
  let resultString = `New lowers to claim: ${unclaimedKeys.length}`;
  resultString += unclaimedKeys.length > 0 ? ` Claiming: ${unclaimedKeys.join(', ')}` : '';
  return resultString;
}

async function updateClaimedLowers(claimedLowerIds, unclaimedLowerProofs, latestClaimedLowerId) {
  claimedLowerIds.forEach(lowerId => {
    delete unclaimedLowerProofs[lowerId];
    latestClaimedLowerId = Math.max(latestClaimedLowerId, lowerId);
  });

  await redis.setAutolowerLatestClaimedLowerId(latestClaimedLowerId);
  await redis.setAutolowerLastT1BlockChecked(lastBlockChecked);
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
    await retryClaim('Cannot check proof', id, proof);
    return false;
  }
}

async function handleProofCheckResult(check, id, proof) {
  if (check.lowerIsClaimed) {
    closeFailedClaim('Already claimed', id, proof);
    return false;
  }

  if (!check.proofIsValid) {
    if (check.confirmationsRequired > check.confirmationsProvided) {
      await regenerateProofAndRetryLower('Not enough confirmations', id, proof);
    } else {
      closeFailedClaim('Invalid proof', id, proof);
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
    closeFailedClaim('Rejected by bridge', id, tx.hash);
  } else {
    closeSuccessfulClaim(id, tx.hash);
  }
}

async function handleClaimError(error, id, proof, bridge) {
  // Consolidate error code checks and handle common cases
  switch (error.code) {
    case 'INSUFFICIENT_FUNDS':
      await retryClaim('Insufficient funds', id, proof);
      break;
    case 'INVALID_ARGUMENT':
      closeFailedClaim('Invalid proof', id, proof);
      break;
    case 'UNPREDICTABLE_GAS_LIMIT':
      await recheckProofToResolve(id, proof, bridge);
      break;
    default:
      await retryClaim('Unknown error', id, proof);
  }
}

async function recheckProofToResolve(id, proof, bridge) {
  try {
    const check = await bridge.checkLower(proof);

    if (check.lowerIsClaimed) {
      closeFailedClaim('Already claimed', id, proof);
    } else if (check.proofIsValid) {
      await retryClaim('Network error', id, proof);
    } else if (check.confirmationsRequired > check.confirmationsProvided) {
      await regenerateProofAndRetryLower('Not enough confirmations', id, proof);
    } else {
      closeFailedClaim('Invalid proof', id, proof);
    }
  } catch (error) {
    await retryClaim('Proof recheck error', id, proof);
  }
}

function closeFailedClaim(message, id, info) {
  log.info(`[Autolower] FAILED - ${message}. Lower ID: ${id}, ${info}`);
}

function closeSuccessfulClaim(id, txHash) {
  log.info(`[Autolower] SUCCEEDED - Lower ID: ${id}, tx hash: ${txHash}`);
}

async function retryClaim(message, id, proof) {
  log.info(`[Autolower] RETRY - ${message}. Lower ID: ${id}, proof: ${proof}`);
  await redis.addAutolowerToRetry(id);
}

async function regenerateProofAndRetryLower(message, id, proof) {
  try {
    log.info(`[Autolower] REGENERATE PROOF - ${message}. Lower ID: ${id}`);
    await avn.regenerateLowerProof(id);
    await redis.addAutolowerToRetry(id);
  } catch (error) {
    await retryClaim('Proof regeneration error', id, proof);
  }
}

module.exports = { autolower };
