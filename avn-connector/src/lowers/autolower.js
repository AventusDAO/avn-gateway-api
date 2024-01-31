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

const ERROR_CODES = {
  INSUFFICIENT_FUNDS: 'Insufficient funds',
  UNPREDICTABLE_GAS_LIMIT: 'Network error',
  INVALID_ARGUMENT: 'Invalid proof'
};

const autolowerAccount = getAutolowerAccount();

function getAutolowerAccount() {
  const canAutolower =
    config.autolower && config.autolower.autolower_pk && config.autolower.autolower_pk !== '$ENV:AUTOLOWER_PK';
  return canAutolower ? config.autolower.autolower_pk : null;
}

async function processLowers() {
  if (!autolowerAccount) {
    log.info('[Autolower] No autolower account set');
    return;
  }

  try {
    const bridge = tier1.connectToBridge((await avn.getChainInfo()).avnContract, LOWERING_ABI, autolowerAccount);

    if (!(await redis.accquireAutolowerLock(bridge.address))) {
      return '[Autolower] Existing claims are still being processed';
    }

    await handleLowers(bridge);
  } catch (error) {
    log.error('[Autolower] Error in processLowers: ', error);
  }
}

async function handleLowers(bridge) {
  let latestClaimedLowerId = await redis.getAutolowerLatestClaimedLowerId();
  const unclaimedLowerProofs = await avn.getUnclaimedLowerProofs(latestClaimedLowerId);
  const fromBlock = (await redis.getAutolowerLastT1BlockChecked()) + 1;
  const [lastBlockChecked, claimedLowerIds] = await tier1.getLowersClaimedSinceBlock(bridge.address, fromBlock);

  await updateClaimedLowers(claimedLowerIds, unclaimedLowerProofs, latestClaimedLowerId);
  claimLowers(bridge, unclaimedLowerProofs); // Don't await, let these run in the background

  const unclaimedKeys = Object.keys(unclaimedLowerProofs);
  let resultString = `[Autolower] New lowers to claim: ${unclaimedKeys.length}`;
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
    if (await checkLowerProof(bridge, id, proof)) {
      await claimLower(bridge, id, proof);
    }
  }

  await redis.releaseAutolowerLock(bridge.address);
}

async function checkLowerProof(bridge, id, proof) {
  try {
    const check = await bridge.checkLower(proof);
    return handleCheckResult(check, id, proof);
  } catch (error) {
    return handleProofError(error, id, proof);
  }
}

async function claimLower(bridge, id, proof) {
  try {
    const tx = await bridge.claimLower(proof);
    return handleTransaction(tx, id);
  } catch (error) {
    return handleClaimError(error, id, proof, bridge);
  }
}

async function handleCheckResult(check, id, proof) {
  if (check.lowerIsClaimed) {
    logFailed('Already claimed', id, proof);
    return false;
  }

  if (!check.proofIsValid) {
    const moreConfirmationsRequired = check.confirmationsRequired > check.confirmationsProvided;
    const message = moreConfirmationsRequired ? 'Not enough confirmations' : 'Invalid proof';
    logFailed(message, id, proof);
    if (moreConfirmationsRequired) {
      await avn.regenerateLowerProof(id);
    }
    return false;
  }

  return true;
}

async function handleProofError(error, id, proof) {
  logError('Cannot check proof', id, proof, error);
  await redis.addAutolowerToBeRetried(id);
  return false;
}

async function handleTransaction(tx, id) {
  const receipt = await tx.wait();
  if (receipt.status === 0) {
    logFailed('Rejected by bridge', id, tx.hash);
  } else {
    logSuccess(id, tx.hash);
  }
}

async function handleClaimError(error, id, proof, bridge) {
  const errorMessage = ERROR_CODES[error.code] || 'Unknown error';
  logFailed(errorMessage, id, proof);
  if (error.code !== 'INVALID_ARGUMENT') {
    await redis.addAutolowerToBeRetried(id);
  }
}

function logFailed(message, id, additionalInfo) {
  log.info(`[Autolower] FAILED - ${message}. Lower ID: ${id}, ${additionalInfo}`);
}

function logSuccess(id, txHash) {
  log.info(`[Autolower] SUCCEEDED - Lower ID: ${id}, tx hash: ${txHash}`);
}

function logError(message, id, additionalInfo, error) {
  log.error(`[Autolower] ERROR - ${message}. Lower ID: ${id}, ${additionalInfo}`, error);
}

module.exports = {
  processLowers
};
