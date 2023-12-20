const utils = require('./utils');
const avn = require('../avn');
const redis = require('../redis');
const tier1 = require('../tier1');
const { isNumber } = require('@polkadot/util');
const log4js = require('log4js');
const log = log4js.getLogger();

const TX_LIMIT = 50;

async function getLowers(addressOrId) {
    log.info(`\nGetting lower data for ${addressOrId}`);
    const { avtContract } = await avn.getChainInfo();

    let lastAvnLowerBlock = await redis.getLastLowerBlockFromAvn();
    let toBlock = await updateLowerData(lastAvnLowerBlock, avtContract);
    await redis.setLastLowerBlockFromAvn(toBlock);
    await deleteClaimedLowers(avtContract);

    if (isNumber(addressOrId)) {
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
      if (toBlockInfo) {
        // Update the starting position (lowers are ordered so the last entry is always the most recent):
        fromId = generateId(toBlockInfo.blockNumber, parseInt(toBlockInfo.index) + 1);
      }
    } while (toBlockInfo);
}

async function processLowerEvents(fromId, avtContract) {
    try {
        const lowersArray = await utils.getLowersFromIndexer(fromId, TX_LIMIT);
        if (lowersArray.length === 0) return null;

        let blockNumber, index;
        let counter = 0;
        const distinctLowers = {};

        for (const newEvent of lowersArray) {
            const lowerId = newEvent?.args?.lowerId;
            const formattedEvent = utils.formatLowerEvent(distinctLowers[lowerId], newEvent, avtContract);

            let currentEventMissingArgs = utils.currentEventMissingArgs(distinctLowers[lowerId])
            let canOverwriteEvent = utils.canOverwriteEvent(distinctLowers[lowerId], newEvent);

            if (canOverwriteEvent || currentEventMissingArgs) {
                if (formattedEvent.name === utils.READY_TO_CLAIM_EVENT_NAME) {
                    formattedEvent.claimData = await avn.getLowerProof(lowerId);
                }

                if (canOverwriteEvent) {
                    console.log(`Overwritting  ${distinctLowers[lowerId].name} with ${formattedEvent.name}`)
                    distinctLowers[lowerId] = formattedEvent;
                    counter++;
                } else if (currentEventMissingArgs) {
                    distinctLowers[lowerId].from = formattedEvent.from;
                    distinctLowers[lowerId].to = formattedEvent.to;
                    distinctLowers[lowerId].amount = formattedEvent.amount;
                } else if (distinctLowers[lowerId].name === utils.READY_TO_CLAIM_EVENT_NAME && !distinctLowers[lowerId].claimData) {
                    distinctLowers[lowerId].claimData = await avn.getLowerProof(lowerId);
                }
            }

            if (!blockNumber || blockNumber < newEvent.block?.height) {
                blockNumber = newEvent.block?.height;
                index = newEvent.indexInBlock || 0;
            } else if (blockNumber === newEvent.block?.height && index < newEvent.indexInBlock) {
                index = newEvent.indexInBlock;
            }
        };

        for (key in distinctLowers) {
             // this will also take care of the sender/recipient mapping
             console.log(`Storing key: ${key}, value: ${JSON.stringify(distinctLowers[key])}`)
             await redis.setLowerById(key, distinctLowers[key]);
        }

        log.info(`Processed ${counter} lower(s) from id ${fromId} to block: ${blockNumber}, index: ${index}`);
        return !!blockNumber && !!index ? { blockNumber, index } : null;
      } catch (err) {
        log.error(`💔 Error processing lower events from ${fromId}. `, err);
        return null;
      }
}

async function getLowerByAddress(address) {
    const lowerData = [];
    const lowerIds = await redis.getLowerIdsByAddress(address);
    console.log(`Found ${JSON.stringify(lowerIds)} lowerId for address ${address}`)
    for (id of lowerIds) {
        let lower = await redis.getLowerById(id);
        if (lower) {
            lowerData.push(lower)
        } else {
            log.error(`Lower Id ${id} for address: ${address} doesn't have any lower data associated.`);
        }
    }
    return lowerData;
}

async function deleteClaimedLowers(avnContract) {
    const lastClaimedEthereumLowerBlock = await redis.getLastClaimedEthereumLowerBlock();
    let [lastBlockChecked, claimedLowerIdsOnEthereum] = await tier1.getLowersClaimedSinceBlock(avnContract, lastClaimedEthereumLowerBlock);

    for (lowerId of claimedLowerIdsOnEthereum) {
        await redis.deleteLowerById(lowerId);
    }

    await redis.setLastClaimedEthereumLowerBlock(lastBlockChecked);
}

module.exports = {
    getLowers
};