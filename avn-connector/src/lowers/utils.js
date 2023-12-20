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
    'TokenManager.TokenLowered': 1,
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
                limit: ${txLimit},
                orderBy: id_DESC
            ) {
                args
                block {
                    height
                }
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

        console.log("Response from GrapghQL: ", JSON.stringify(response?.data?.data?.events, null, 2));
        return response?.data?.data?.events || [];
    } catch (error) {
        log.error('💔 Error fetching lower events:', error);
        return [];
    }
}

function formatLowerEvent(currentEvent, newEvent, avtContract) {
    let lowerEvent = newEvent;
    if (currentEvent && newEvent.name == READY_TO_CLAIM_EVENT_NAME) {
        lowerEvent = currentEvent;
        lowerEvent.name = READY_TO_CLAIM_EVENT_NAME;
    }

    const lowerData = {
        lowerId: lowerEvent?.args?.lowerId,
        token: lowerEvent?.args?.tokenId || avtContract,
        to: lowerEvent?.args?.t1Recipient?.toLowerCase(),
        amount: isHex(lowerEvent?.args?.amount) ? hexToBn(lowerEvent?.args?.amount).toString() : lowerEvent?.args?.amount,
        name: lowerEvent.name
    };

    lowerData.from = lowerEvent?.name === LOWER_REQUEST_EVENT_NAME ? lowerEvent?.args?.from : lowerEvent?.args?.sender;

    return lowerData;
}

function canOverwriteEvent(currentEvent, newEvent) {
    if (!currentEvent) return true;

    let transitionIsValid = lowerStates[newEvent.name] > lowerStates[currentEvent.name];
    let currentEventMissingArgs = ['to', 'amount'].every(prop => currentEvent[prop] === null || currentEvent[prop] === undefined);
    return transitionIsValid || currentEventMissingArgs;
}

module.exports = {
    formatLowerEvent,
    getLowersFromIndexer,
    READY_TO_CLAIM_EVENT_NAME,
    lowerStates,
    canOverwriteEvent
  };