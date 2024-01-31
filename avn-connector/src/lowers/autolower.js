const utils = require('./utils');
const avn = require('../avn');
const redis = require('../redis');
const tier1 = require('../tier1');
const log4js = require('log4js');
const log = log4js.getLogger();

const provider = tier1.provider;
const autoLowerAccount = new ethers.Wallet(config.autolower.autolower_pk, provider);

async function processLowers() {
  if (hasAutolowerAccount() === false) return 'No autolower account set';

  const { avnContract } = await avn.getChainInfo();

  if (await redis.accquireAutolowerLock(avnContract)) {
    let latestClaimedLowerId = await redis.getAutolowerLatestClaimedLowerId();
    const unclaimedLowerProofs = await avn.getUnclaimedLowerProofs(latestClaimedLowerId);
    const fromBlock = (await redis.getAutolowerLastT1BlockChecked()) + 1;
    const [lastBlockChecked, claimedLowerIds] = await getLowersClaimedSinceBlock(avnContract, fromBlock);

    claimedLowerIds.forEach(lowerId => {
      delete unclaimedLowerProofs[lowerId];
      latestClaimedLowerId = Math.max(latestClaimedLowerId, lowerId);
    });

    const avnBridge = await connectToBridge(avnContract);
    await redis.setAutolowerLatestClaimedLowerId(latestClaimedLowerId);
    await redis.setAutolowerLastT1BlockChecked(lastBlockChecked);
    claimLowers(avnBridge, unclaimedLowerProofs); // Don't await, let these run in the background
    const unclaimedKeys = Object.keys(unclaimedLowerProofs);
    const claimingString = unclaimedKeys.length > 0 ? ` Claiming: ${unclaimedKeys.join(', ')}` : '';
    const resultString = `New lowers to claim: ${unclaimedKeys.length}`;
    return resultString + claimingString;
  } else {
    return 'Existing lower claims are still being processed';
  }
}

async function connectToBridge(avnContract) {
  const loweringABI = [
    'function claimLower(bytes calldata)',
    'function checkLower(bytes calldata) external view returns (address token, uint256 amount, address recipient, uint32 lowerId, uint256 confirmationsRequired, uint256 confirmationsProvided, bool proofIsValid, bool lowerIsClaimed)'
  ];
  return new ethers.Contract(avnContract, loweringABI, autoLowerAccount);
}

function hasAutolowerAccount() {
  return 'autolower_pk' in config.autolower && config.autolower.autolower_pk !== '$ENV:AUTOLOWER_PK';
}

async function claimLowers(avnBridge, lowerProofs) {
  if (Object.keys(lowerProofs).length === 0) {
    return await redis.releaseAutolowerLock(avnBridge.address);
  }

  for (const [id, proof] of Object.entries(lowerProofs)) {
    await redis.refreshAutolowerLock(avnBridge.address);
    if (await checkLowerProof(avnBridge, id, proof)) {
      await claimLower(avnBridge, id, proof);
    }
  }

  return await redis.releaseAutolowerLock(avnBridge.address);
}

async function checkLowerProof(avnBridge, id, proof) {
  try {
    const check = await avnBridge.checkLower(proof);
    return handleCheckResult(check, id, proof);
  } catch (error) {
    return handleProofError(error, id, proof);
  }
}

async function claimLower(avnBridge, id, proof) {
  try {
    const tx = await avnBridge.claimLower(proof);
    return handleTransaction(tx, id);
  } catch (error) {
    return handleClaimError(error, id, proof, avnBridge);
  }
}

function handleCheckResult(check, id, proof) {
  if (check.lowerIsClaimed) {
    logFailed('Already claimed', id, proof);
    return false;
  }

  if (!check.proofIsValid) {
    logFailed(check.confirmationsRequired > check.confirmationsProvided ?
      'Not enough confirmations' : 'Invalid proof', id, proof);
    if (check.confirmationsRequired > check.confirmationsProvided) {
      regenerateLowerProof(id);
    }
    return false;
  }

  return true;
}

function handleProofError(error, id, proof) {
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

async function handleClaimError(error, id, proof, avnBridge) {
  if (error.code === 'INSUFFICIENT_FUNDS' || error.code === 'UNPREDICTABLE_GAS_LIMIT' || error.code === 'INVALID_ARGUMENT') {
    logFailed(getErrorMessage(error.code), id, proof);
    if (error.code !== 'INVALID_ARGUMENT') {
      await redis.addAutolowerToBeRetried(id);
    }
    return;
  }
  logError('Unknown error', id, proof, error);
  await redis.addAutolowerToBeRetried(id);
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

function getErrorMessage(errorCode) {
  switch (errorCode) {
    case 'INSUFFICIENT_FUNDS':
      return 'Insufficient funds';
    case 'UNPREDICTABLE_GAS_LIMIT':
      return 'Network error';
    case 'INVALID_ARGUMENT':
      return 'Invalid proof';
    default:
      return 'Error';
  }
}

module.exports = {
  processLowers
};