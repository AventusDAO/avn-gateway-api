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

      // handle multiple events for the same lowerId
      currentEvent = await utils.updateEventStatusIfRequired(currentEvent, newEvent)

      distinctLowers[lowerId] = currentEvent;
    }

    for (key in distinctLowers) {
      // One last check to make sure we don't overwrite stored events.
      // This can happen if events are split across different batches (txLimits)
      let storedLower = await redis.getLowerById(key);
      let newLower = distinctLowers[key];

      if (!storedLower) {
        // there is nothing saved already so add the new event

        log.trace(`Storing key: ${key}, value: ${JSON.stringify(newLower)}`);
        await redis.setLowerById(key, newLower);
      } else {
        storedLower = await utils.updateEventStatusIfRequired(storedLower, newLower)

        log.trace(`Storing key: ${key}, value: ${JSON.stringify(storedLower)}`);
        await redis.setLowerById(key, storedLower);
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

module.exports = {
  getLowers
};