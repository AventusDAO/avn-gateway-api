const utils = require('./utils');
const avn = require('../avn');
const redis = require('../redis');
const tier1 = require('../tier1');
const log4js = require('log4js');
const log = log4js.getLogger();

const TX_LIMIT = 50;

async function getLowers(addressOrId) {
  log.info(`Getting lower data for ${addressOrId}`);
  const { avnContract } = await avn.getChainInfo();

  const lastAvnLowerBlockId = await redis.getLastLowerBlockIdFromAvn();
  const parsedLastAvnLowerBlockId = utils.parseBlockId(lastAvnLowerBlockId);

  const toBlock = await updateLowerData(parsedLastAvnLowerBlockId, avnContract);
  await redis.setLastLowerBlockIdFromAvn(toBlock);
  await deleteClaimedLowers(avnContract);

  if (utils.isLowerId(addressOrId)) {
    return await redis.getLowerById(addressOrId);
  } else {
    return await getLowerByAddress(addressOrId);
  }
}

async function updateLowerData(lastAvnLowerBlockId, avtContract) {
  const generateId = (block, index) =>
    [block.toString().padStart(10, '0'), index.toString().padStart(6, '0'), '00000'].join('-');

  let fromBlockId = generateId(lastAvnLowerBlockId.blockNumber, lastAvnLowerBlockId.index);
  let toBlockInfo;

  // Loop to retrieve lowers so as not to exceed the indexer limit:
  do {
    toBlockInfo = await processLowerEvents(fromBlockId, avtContract);
    log.info(`Processing lowers from ${fromBlockId}. Next batch: ${JSON.stringify(toBlockInfo || {})}`);
    if (toBlockInfo) {
      // Update the starting position (lowers are ordered so the last entry is always the most recent):
      fromBlockId = generateId(toBlockInfo.blockNumber, parseInt(toBlockInfo.index) + 1);
    }
  } while (toBlockInfo);

  return fromBlockId;
}

async function processLowerEvents(fromId, avtContract) {
  try {
    const lowersArray = await utils.getLowersFromIndexer(fromId, TX_LIMIT);
    if (lowersArray.length === 0) return null;

    let blockNumber, index;
    let counter = 0;
    const distinctLowers = {};

    for (const lowerData of lowersArray) {
      [blockNumber, index] = utils.updateBlockNumberAndIndex(lowerData, blockNumber, index);

      const lowerId = lowerData?.args?.lowerId;
      let currentEvent = distinctLowers[lowerId];
      const newEvent = utils.formatLowerEvent(lowerData, avtContract);

      if (newEvent.name === utils.READY_TO_CLAIM_EVENT_NAME) {
        newEvent.claimData = await avn.getLowerProof(lowerId);
      }

      if (!currentEvent) {
        distinctLowers[lowerId] = newEvent;
        continue;
      }

      if (utils.currentEventMissingArgs(currentEvent)) {
        currentEvent = utils.updateEventArgs(currentEvent, newEvent);
      }

      if (utils.canOverwriteEvent(currentEvent, newEvent)) {
        currentEvent.name = newEvent.name;
        currentEvent.claimData = newEvent.claimData;
      } else {
        // this is an edge case where the existiing entry in redis is corrupted somehow
        if (currentEvent.name === utils.READY_TO_CLAIM_EVENT_NAME && !currentEvent.claimData) {
          currentEvent.claimData = await avn.getLowerProof(lowerId);
        }
      }

      distinctLowers[lowerId] = currentEvent;
    }

    for (key in distinctLowers) {
      // One last check to make sure we don't overwrite stored events.
      // This can happen if events are split across different batches (txLimits)
      let storedLower = await redis.getLowerById(key);
      let newLower = distinctLowers[key];
      if (utils.canOverwriteEvent(storedLower, newLower)) {
        log.trace(`Storing key: ${key}, value: ${JSON.stringify(newLower)}`);
        // this will also take care of the sender/recipient mapping
        await redis.setLowerById(key, newLower);
      }
      counter++;
    }

    log.info(`Processed ${counter} lower(s) from id ${fromId} to block: ${blockNumber}, index: ${index}`);
    return { blockNumber, index };
  } catch (err) {
    log.error(`💔 Error processing lower events. From: ${fromId}. `, err);
    return null;
  }
}

async function getLowerByAddress(address) {
  const lowerData = [];
  const lowerIds = await redis.getLowerIdsByAddress(address);
  for (id of lowerIds) {
    let lower = await redis.getLowerById(id);
    if (lower) {
      lowerData.push(lower);
    } else {
      log.error(`💔 Lower Id ${id} for address: ${address} doesn't have any lower data associated.`);
    }
  }
  return lowerData;
}

async function deleteClaimedLowers(avnContract) {
  const lastClaimedEthereumLowerBlock = await redis.getLastClaimedEthereumLowerBlock();
  let [lastBlockChecked, claimedLowerIdsOnEthereum] = await tier1.getLowersClaimedSinceBlock(
    avnContract,
    parseInt(lastClaimedEthereumLowerBlock) + 1
  );
  for (lowerId of claimedLowerIdsOnEthereum) {
    log.trace(`Deleting lower id ${lowerId}`);
    await redis.deleteLowerById(lowerId);
  }

  await redis.setLastClaimedEthereumLowerBlock(lastBlockChecked);
}

async function autolower() {
  if (tier1.hasAutolowerAccount() === false) return 'No autolower account set';

  const { avnContract } = await avn.getChainInfo();

  if (await redis.accquireAutolowerLock(avnContract)) {
    let latestClaimedLowerId = await redis.getAutolowerLatestClaimedLowerId();
    const unclaimedLowerProofs = await avn.getUnclaimedLowerProofs(latestClaimedLowerId);
    const fromBlock = (await redis.getAutolowerLastT1BlockChecked()) + 1;
    const [lastBlockChecked, claimedLowerIds] = await tier1.getLowersClaimedSinceBlock(avnContract, fromBlock);

    claimedLowerIds.forEach(lowerId => {
      delete unclaimedLowerProofs[lowerId];
      latestClaimedLowerId = Math.max(latestClaimedLowerId, lowerId);
    });

    const avnBridge = await tier1.connectToBridge(avnContract);
    await redis.setAutolowerLatestClaimedLowerId(latestClaimedLowerId);
    await redis.setAutolowerLastT1BlockChecked(lastBlockChecked);
    tier1.claimLowers(avnBridge, unclaimedLowerProofs); // Don't await, let these run in the background
    const unclaimedKeys = Object.keys(unclaimedLowerProofs);
    const claimingString = unclaimedKeys.length > 0 ? ` Claiming: ${unclaimedKeys.join(', ')}` : '';
    const resultString = `New lowers to claim: ${unclaimedKeys.length}`;
    return resultString + claimingString;
  } else {
    return 'Existing lower claims are still being processed';
  }
}

module.exports = {
  autolower,
  getLowers
};
