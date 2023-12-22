const axios = require('axios');
const log4js = require('log4js');
const log = log4js.getLogger();
const config = require('multiconfig').load();
const { hexToBn, isHex } = require('@polkadot/util');

const AVN_EXPLORER_URL = config.avnExplorerUrl;
const READY_TO_CLAIM_EVENT_NAME = 'TokenManager.LowerReadyToClaim';
const LOWER_REQUEST_EVENT_NAME = 'TokenManager.LowerRequested';

const lowerStates = {
  'TokenManager.AvtLowered': 1,
  'TokenManager.TokenLowered': 1
};
lowerStates[LOWER_REQUEST_EVENT_NAME] = 0;
lowerStates[READY_TO_CLAIM_EVENT_NAME] = 2;

async function getLowersFromIndexer(fromId, txLimit) {
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

    let lowerEvents = response?.data?.data?.events;
    if (lowerEvents) {
      return sortLowerEventsByIdAsc(lowerEvents);
    }

    return [];
  } catch (error) {
    log.error('💔 Error fetching lower events:', error);
    return [];
  }
}

function formatLowerEvent(lowerEvent, avtContract) {
  const lowerData = {
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

function canOverwriteEvent(currentEvent, newEvent) {
  if (!currentEvent) return true;

  let transitionIsValid = lowerStates[newEvent?.name] > lowerStates[currentEvent?.name];
  return transitionIsValid;
}

function currentEventMissingArgs(currentEvent) {
  if (!currentEvent) return false;
  return ['from', 'to', 'amount'].every(prop => currentEvent[prop] === null || currentEvent[prop] === undefined);
}

function updateEventArgs(currentEvent, newEvent) {
  currentEvent.from = newEvent.from;
  currentEvent.to = newEvent.to;
  currentEvent.amount = newEvent.amount;
  return currentEvent;
}

function updateBlockNumberAndIndex(lowerData, blockNumber, index) {
  blockNumber = parseInt(blockNumber) || 0;
  index = parseInt(index) || 0;

  if (!lowerData || !lowerData.block) return [blockNumber, index];

  const lowerBlockHeight = parseInt(lowerData.block.height) || 0;
  const lowerIndexInBlock = parseInt(lowerData.indexInBlock) || 0;

  if (blockNumber < lowerBlockHeight) {
    blockNumber = lowerBlockHeight;
    index = lowerIndexInBlock;
  } else if (blockNumber === lowerBlockHeight && index < lowerIndexInBlock) {
    index = lowerIndexInBlock;
  }

  return [blockNumber, index];
}

// We can't use parseInt or isNumber because a hex input will be treated as a valid number
function isLowerId(input) {
  // Check if the input contains only decimal numbers
  return /^[0-9]+$/.test(input);
}

function parseBlockId(fromBlockId) {
  if (!fromBlockId) {
    return {blockNumber: 0, index: 0}
  }

  let blockInfo = fromBlockId.split("-");
  return {blockNumber: blockInfo[0] || 0, index: blockInfo[1] || 0}
}

function sortLowerEventsByIdAsc(lowerEvents) {
  return lowerEvents.sort((a, b) => {
    if (a.id === b.id) {
      return 0;
    } else if (a.id < b.id) {
      return -1;
    } else {
      return 1;
    }
  });
}

module.exports = {
  formatLowerEvent,
  getLowersFromIndexer,
  READY_TO_CLAIM_EVENT_NAME,
  lowerStates,
  canOverwriteEvent,
  currentEventMissingArgs,
  updateEventArgs,
  updateBlockNumberAndIndex,
  isLowerId,
  parseBlockId
};
