import axios from 'axios';
import logger from '../logger';
const config = require('multiconfig').load();
import { hexToBn, isHex } from '@polkadot/util';
import avn from '../avn';

const AVN_EXPLORER_URL = config.avnExplorerUrl;
const READY_TO_CLAIM_EVENT_NAME = 'TokenManager.LowerReadyToClaim';
const LOWER_REQUEST_EVENT_NAME = 'TokenManager.LowerRequested';

const lowerStates: Record<string, number> = {
  'TokenManager.AvtLowered': 1,
  'TokenManager.TokenLowered': 1
};
lowerStates[LOWER_REQUEST_EVENT_NAME] = 0;
lowerStates[READY_TO_CLAIM_EVENT_NAME] = 2;

interface LowerEvent {
  args: {
    lowerId?: string;
    tokenId?: string;
    t1Recipient?: string;
    amount?: string;
    from?: string;
    sender?: string;
  };
  block: {
    height: string;
  };
  id: string;
  indexInBlock: string;
  name: string;
  claimData?: any;
}

interface LowerData {
  lowerId?: string;
  token?: string;
  to?: string;
  amount?: string;
  name?: string;
  from?: string;
  claimData?: any;
  [key: string]: string | undefined | any;
}

interface BlockId {
  blockNumber: number;
  index: number;
}

async function getLowersFromIndexer(fromId: string, txLimit: number): Promise<LowerEvent[]> {
  const query = `
        query LowerQuery {
            events(
                where: {
                    name_in:["TokenManager.TokenLowered", "TokenManager.AvtLowered", "${LOWER_REQUEST_EVENT_NAME}", "${READY_TO_CLAIM_EVENT_NAME}"],
                    id_gte: "${fromId}"
                },
                limit: ${txLimit}
            ) {
                args
                block {
                    height
                }
                id
                indexInBlock
                name
            }
        }
    `;

  try {
    const response = await axios.post(AVN_EXPLORER_URL, {
      query,
      operationName: 'LowerQuery'
    });

    const lowerEvents = response?.data?.data?.events as LowerEvent[];
    if (lowerEvents) {
      return sortLowerEventsByIdAsc(lowerEvents);
    }

    return [];
  } catch (error) {
    logger.error('💔 Error fetching lower events:', error);
    return [];
  }
}

function formatLowerEvent(lowerEvent: LowerEvent, avtContract: string): LowerData {
  const lowerData: LowerData = {
    lowerId: lowerEvent?.args?.lowerId,
    token: lowerEvent?.args?.tokenId || avtContract,
    to: lowerEvent?.args?.t1Recipient?.toLowerCase(),
    amount: isHex(lowerEvent?.args?.amount) ? hexToBn(lowerEvent?.args?.amount).toString() : lowerEvent?.args?.amount,
    name: lowerEvent?.name,
    claimData: lowerEvent?.claimData
  };

  lowerData.from = lowerEvent?.name === LOWER_REQUEST_EVENT_NAME ? lowerEvent?.args?.from : lowerEvent?.args?.sender;

  return lowerData;
}

function canUpdateEventStatus(currentEvent: LowerData, newEvent: LowerData): boolean {
  if (!currentEvent || Object.keys(currentEvent).length === 0) return true;

  const transitionIsValid = lowerStates[newEvent?.name!] > lowerStates[currentEvent?.name!];
  return transitionIsValid;
}

function currentEventMissingArgs(currentEvent: LowerData): boolean {
  if (!currentEvent) return false;
  return ['from', 'to', 'amount'].every(prop => currentEvent[prop] === null || currentEvent[prop] === undefined);
}

function updateEventArgs(currentEvent: LowerData, newEvent: LowerData): LowerData {
  currentEvent.from = newEvent.from;
  currentEvent.to = newEvent.to;
  currentEvent.amount = newEvent.amount;
  return currentEvent;
}

function updateBlockNumberAndIndex(lowerData: LowerEvent, blockNumber: number, index: number): [number, number] {
  blockNumber = Number(blockNumber.toString()) || 0;
  index = Number(index.toString()) || 0;

  if (!lowerData || !lowerData.block) return [blockNumber, index];

  const lowerBlockHeight = Number(lowerData.block.height) || 0;
  const lowerIndexInBlock = Number(lowerData.indexInBlock) || 0;

  if (blockNumber < lowerBlockHeight) {
    blockNumber = lowerBlockHeight;
    index = lowerIndexInBlock;
  } else if (blockNumber === lowerBlockHeight && index < lowerIndexInBlock) {
    index = lowerIndexInBlock;
  }

  return [blockNumber, index];
}

// We can't use Number or isNumber because a hex input will be treated as a valid number
function isLowerId(input: string): boolean {
  // Check if the input contains only decimal numbers
  return /^[0-9]+$/.test(input);
}

function parseBlockId(fromBlockId: string): BlockId {
  if (!fromBlockId) {
    return { blockNumber: 0, index: 0 };
  }

  const blockInfo = fromBlockId.split('-');
  return { blockNumber: Number(blockInfo[0]) || 0, index: Number(blockInfo[1]) || 0 };
}

function sortLowerEventsByIdAsc(lowerEvents: LowerEvent[]): LowerEvent[] {
  return lowerEvents.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

async function updateEventStatusIfRequired(currentEvent: LowerData, newEvent: LowerData): Promise<LowerData> {
  if (!newEvent || !currentEvent) return currentEvent;

  if (currentEventMissingArgs(currentEvent)) {
    currentEvent = updateEventArgs(currentEvent, newEvent);
  }

  if (canUpdateEventStatus(currentEvent, newEvent)) {
    currentEvent.name = newEvent.name;
    currentEvent.claimData = newEvent.claimData;
  } else {
    // this is an edge case where the existing entry in redis is corrupted somehow
    if (currentEvent.name === READY_TO_CLAIM_EVENT_NAME && !currentEvent.claimData) {
      currentEvent.claimData = await avn.getLowerProof(Number(newEvent.lowerId!));
    }
  }

  return currentEvent;
}

const utils = {
  formatLowerEvent,
  getLowersFromIndexer,
  READY_TO_CLAIM_EVENT_NAME,
  lowerStates,
  canUpdateEventStatus,
  currentEventMissingArgs,
  updateEventArgs,
  updateBlockNumberAndIndex,
  isLowerId,
  parseBlockId,
  updateEventStatusIfRequired
};
export default utils;
