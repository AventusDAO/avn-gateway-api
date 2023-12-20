const utils = require('./utils');
const avn = require('../avn');
const redis = require('../redis');
const tier1 = require('../tier1');
const { isNumber } = require('@polkadot/util');
const log4js = require('log4js');
const log = log4js.getLogger();

const TX_LIMIT = 50;

async function getLowers(addressOrId) {
    log.info(`Getting lower data for ${addressOrId}`);
    const { avtContract } = await avn.getChainInfo();

    let lastAvnLowerBlock = await redis.getLastLowerBlockFromAvn();
    let toBlock = await updateLowerData(0 /*lastAvnLowerBlock*/, avtContract);
    await redis.setLastLowerBlockFromAvn(toBlock);
    await deleteClaimedLowers(avtContract);

    if (utils.isLowerId(addressOrId)) {
        return await redis.getLowerById(addressOrId);
    } else {
        return await getLowerByAddress(addressOrId);
    }
}

async function updateLowerData(fromBlock, avtContract) {
    const generateId = (block, index) => [block.toString().padStart(10, '0'), index.toString().padStart(6, '0'), '00000'].join('-');

    let toBlockInfo;
    let fromId = generateId(fromBlock, 0);

    // Loop to retrieve lowers so as not to exceed the indexer limit:
    do {
        toBlockInfo = await processLowerEvents(fromId, avtContract);
        log.info(`Processing lowers from ${fromId}. Next batch: ${JSON.stringify(toBlockInfo || {})}`);
        if (toBlockInfo) {
            // Update the starting position (lowers are ordered so the last entry is always the most recent):
            fromId = generateId(toBlockInfo.blockNumber, parseInt(toBlockInfo.index) + 1);
        }
    } while (toBlockInfo);

    return fromId;
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
        };

        for (key in distinctLowers) {
            // One last check to make sure we don't overrite stored events.
            // This can happen if events are split across different batches (txLimits)
            let storedLower = await redis.getLowerById(key);
            let newLower = distinctLowers[key];
            //if (utils.canOverwriteEvent(storedLower, newLower)) {
                log.trace(`Storing key: ${key}, value: ${JSON.stringify(newLower)}`)
                // this will also take care of the sender/recipient mapping
                await redis.setLowerById(key, newLower);
            //}
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
    log.trace(`LowerIds for address ${address}: ${JSON.stringify(lowerIds)}`);
    for (id of lowerIds) {
        let lower = await redis.getLowerById(id);
        if (lower) {
            lowerData.push(lower)
        } else {
            log.error(`💔 Lower Id ${id} for address: ${address} doesn't have any lower data associated.`);
        }
    }
    return lowerData;
}

async function deleteClaimedLowers(avnContract) {
    const lastClaimedEthereumLowerBlock = await redis.getLastClaimedEthereumLowerBlock();
    let [lastBlockChecked, claimedLowerIdsOnEthereum] = await tier1.getLowersClaimedSinceBlock(avnContract, 0 /*lastClaimedEthereumLowerBlock*/);

    for (lowerId of claimedLowerIdsOnEthereum) {
        log.trace(`Deleting lower id ${lowerId}`)
        await redis.deleteLowerById(lowerId);
    }

    await redis.setLastClaimedEthereumLowerBlock(lastBlockChecked);
}

module.exports = {
    getLowers
};