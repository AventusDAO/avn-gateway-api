import { ethers } from 'ethers';
import utils from './utils';
import avn from '../avn';
import redis from '../redis';
import tier1 from '../tier1';
import logger from '../logger';
import { LowerData, BlockId } from '../types';

const TX_LIMIT = 50;

async function getLowers(addressOrId: string): Promise<LowerData | null> {
  logger.info(`Getting lower data for ${addressOrId}`);
  const { avnContract } = await avn.getChainInfo();

  const lastAvnLowerBlockId = await redis.getLastLowerBlockIdFromAvn();
  const parsedLastAvnLowerBlockId: BlockId =
    utils.parseBlockId(lastAvnLowerBlockId);

  const toBlock = await updateLowerData(parsedLastAvnLowerBlockId, avnContract);
  await redis.setLastLowerBlockIdFromAvn(toBlock);
  await deleteClaimedLowers(avnContract);

  if (utils.isLowerId(addressOrId)) {
    const lowerId = Number(addressOrId);
    return await getLower(lowerId);
  } else {
    return await getLowerByAddress(addressOrId);
  }
}

async function updateLowerData(
  lastAvnLowerBlockId: BlockId,
  avtContract: string
): Promise<string> {
  const generateId = (block: number, index: number): string =>
    [
      block.toString().padStart(10, '0'),
      index.toString().padStart(6, '0'),
      '00000'
    ].join('-');

  let fromBlockId = generateId(
    lastAvnLowerBlockId.blockNumber,
    lastAvnLowerBlockId.index
  );
  let toBlockInfo: BlockId | null;
  // Loop to retrieve lowers so as not to exceed the indexer limit:
  do {
    toBlockInfo = await processLowerEvents(fromBlockId, avtContract);
    logger.info(
      `Processing lowers from ${fromBlockId}. Next batch: ${JSON.stringify(toBlockInfo || {})}`
    );
    if (toBlockInfo) {
      // Update the starting position (lowers are ordered so the last entry is always the most recent):
      fromBlockId = generateId(
        toBlockInfo.blockNumber,
        Number(toBlockInfo.index.toString()) + 1
      );
    }
  } while (toBlockInfo);

  return fromBlockId;
}

async function processLowerEvents(
  fromId: string,
  avtContract: string
): Promise<BlockId | null> {
  try {
    const lowersArray = await utils.getLowersFromIndexer(fromId, TX_LIMIT);
    if (lowersArray.length === 0) return null;

    let blockNumber: number = 0;
    let index: number = 0;
    let counter = 0;
    const distinctLowers: Record<number, LowerData> = {};

    for (const lowerData of lowersArray) {
      [blockNumber, index] = utils.updateBlockNumberAndIndex(
        lowerData,
        blockNumber,
        index
      );

      const lowerIdRaw = lowerData?.args?.lowerId;
      if (lowerIdRaw == null) continue;

      const lowerId = ethers.BigNumber.from(lowerIdRaw).toNumber();
      if (typeof lowerId !== 'number' || isNaN(lowerId)) continue;

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
      currentEvent = await utils.updateEventStatusIfRequired(
        currentEvent,
        newEvent
      );

      distinctLowers[lowerId] = currentEvent;
    }

    for (const keyStr in distinctLowers) {
      const key = Number(keyStr);
      // One last check to make sure we don't overwrite stored events.
      // This can happen if events are split across different batches (txLimits)
      let storedLower = await redis.getLowerById(key);
      let newLower = distinctLowers[key];

      if (!storedLower) {
        // there is nothing saved already so add the new event
        logger.info(`Storing key: ${key}, value: ${JSON.stringify(newLower)}`);
        await redis.setLowerById(key, newLower);
      } else {
        storedLower = await utils.updateEventStatusIfRequired(
          storedLower,
          newLower
        );

        logger.info(
          `Storing key: ${key}, value: ${JSON.stringify(storedLower)}`
        );
        await redis.setLowerById(key, storedLower);
      }

      counter++;
    }

    logger.info(
      `Processed ${counter} lower(s) from id ${fromId} to block: ${blockNumber}, index: ${index}`
    );
    return { blockNumber, index };
  } catch (err) {
    logger.error(`💔 Error processing lower events. From: ${fromId}. `, err);
    return null;
  }
}

async function getLowerByAddress(address: string): Promise<any[]> {
  const lowerData: any[] = [];
  const lowerIds = await redis.getLowerIdsByAddress(address);
  for (const id of lowerIds) {
    let lower = await getLower(id);
    if (lower) {
      lowerData.push(lower);
    } else {
      logger.error(
        `💔 Lower Id ${id} for address: ${address} doesn't have any lower data associated.`
      );
    }
  }
  return lowerData;
}

async function deleteClaimedLowers(avnContract: string): Promise<void> {
  const lastClaimedEthereumLowerBlock =
    await redis.getLastClaimedEthereumLowerBlock();
  let [lastBlockChecked, claimedLowerIdsOnEthereum] =
    await tier1.getLowersClaimedSinceBlock(
      avnContract,
      Number(lastClaimedEthereumLowerBlock) + 1
    );
  for (const lowerId of claimedLowerIdsOnEthereum) {
    logger.info(`Deleting lower id ${lowerId}`);
    await redis.deleteLowerById(lowerId);
  }

  await redis.setLastClaimedEthereumLowerBlock(lastBlockChecked);
}

async function getLower(lowerId: number): Promise<LowerData | null> {
  const lower = await redis.getLowerById(lowerId);
  if (lower == null) return null;
  if (lower.name === utils.READY_TO_CLAIM_EVENT_NAME || lower.name === utils.LOWER_FAILED_EVENT_NAME) return lower;

  if (await utils.isFailedLower(lowerId)) {
    lower.name = utils.LOWER_FAILED_EVENT_NAME;
    await redis.setLowerById(lowerId, lower);
  }

  return lower;
}

const loweringV2 = {
  getLowers
};
export default loweringV2;
