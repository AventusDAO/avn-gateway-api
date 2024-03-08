const utils = require('/opt/utils.js');

const AVN_CONNECTOR_ENDPOINT = process.env.AVN_CONNECTOR_ENDPOINT;
const BLOCK_EXPLORER_BASE_URL = process.env.BLOCK_EXPLORER_BASE_URL;
const TX_LIMIT = 2500;

// Make sure this is kept in sync with the state names defined in avn-connector/src/redis.js
const transactionStatus = {
  Processed: 'Processed',
  Rejected: 'Rejected',
  Validating: 'Validating'
};

// any cross chain transactions such as lifting will emit this event
const NEW_CROSS_CHAIN_EVENTS = ['EthereumEvents.EthereumEventAdded', 'EthereumEvents.NftEthereumEventAdded'];
const SUCCESS_CROSS_CHAIN_EVENT = 'EthereumEvents.EventAccepted';
const FAILED_CROSS_CHAIN_EVENT = 'EthereumEvents.EventRejected';

const successFilter = ['System.ExtrinsicSuccess'];
const failureFilter = ['System.ExtrinsicFailed', 'AvnProxy.InnerCallFailed', 'EthereumEvents.EventRejected'];

// Any extrinsics for which we wish to capture event output can be added to the argsFilter:
const argsFilter = [
  'NftManager.SingleNftMinted',
  'NftManager.BatchNftMinted',
  'NftManager.BatchCreated',
  'TokenManager.LowerRequested'
];

exports.handler = async _event => {
  try {
    const response = {
      statusCode: 200,
      body: JSON.stringify(await processRequest())
    };

    return response;
  } catch (err) {
    const errorResponse = {
      statusCode: 500,
      error: { message: err.message }
    };

    return errorResponse;
  }
};

async function processRequest() {
  const pendingTransactionHashes = (await utils.axios.get(AVN_CONNECTOR_ENDPOINT + 'pendingTransactions')).data;

  if (!pendingTransactionHashes || pendingTransactionHashes.length == 0) {
    console.info('No pending transactions to resolve');
    return;
  }

  let transactions;

  try {
    const events = await getTransactionEventsFromIndexer(pendingTransactionHashes);
    let { txEvents, crossChainTxMap } = processTransactionsEvents(events);
    crossChainTxMap = await updateCrossChainTxStatuses(crossChainTxMap);

    // For cross chain transactions, the block number and index relate to the initial extrinsic
    // NOT the one that finally processes the request.
    // Example: Lift (Block: 10, Index: 1) -> Validate Tx -> Process Lift (Block: 20, index: 3).
    transactions = Object.values(txEvents).map(txEvent => {
      return {
        transactionHash: txEvent.extrinsic.hash,
        status: calculateTransactionStatus(txEvent, failureFilter, crossChainTxMap),
        blockNumber: txEvent.extrinsic.block.height,
        index: txEvent.extrinsic.indexInBlock,
        eventArgs: argsFilter.includes(txEvent.name) ? txEvent.args : {}
      };
    });
  } catch (error) {
    console.log(error);
    throw new Error(`Error calculating transaction statuses: ${error}`);
  }

  await utils.axios.post(AVN_CONNECTOR_ENDPOINT + 'resolvePendingTransactions', { transactions });
}

async function getTransactionEventsFromIndexer(transactionHashes) {
  let query;

  try {
    log('Requesting', transactionHashes);

    const extrinsicFilter = successFilter.concat(failureFilter).concat(argsFilter).concat(NEW_CROSS_CHAIN_EVENTS);
    const limit = Math.min(extrinsicFilter.length * transactionHashes.length, TX_LIMIT);

    query = `query GatewayApiStatus { events(where: {extrinsic: {hash_in: ${JSON.stringify(transactionHashes)}},
        name_in: ${JSON.stringify(extrinsicFilter)}}, limit: ${limit})
        { name args extrinsic { hash indexInBlock success block { height } } } }`;

    const response = await utils.axios.post(BLOCK_EXPLORER_BASE_URL, { query, operationName: 'GatewayApiStatus' });
    return response?.data?.data?.events || [];
  } catch (error) {
    console.error(error);
    throw new Error(`Error getting transaction events from graphQL.\nQuery: ${query}\nError: ${error}`);
  }
}

function processTransactionsEvents(transactionEvents) {
  // The same transaction can have multiple events returned for it. Here we reduce them
  // by having any failure events or events with args supplant success events:
  const txEvents = {};
  const crossChainTxMap = new Map();

  transactionEvents.forEach(event => {
    const txHash = event.extrinsic.hash;
    if (failureFilter.concat(argsFilter).includes(event.name) || txHash in txEvents === false) {
      txEvents[txHash] = event;
    }

    if (NEW_CROSS_CHAIN_EVENTS.includes(event.name)) {
      // we have a successfull new cross chain transaction, set the status to validating and have 2 keys in the map
      crossChainTxMap.set(txHash, { ...event.args.ethEventId, status: transactionStatus.Validating });
      crossChainTxMap.set(JSON.stringify(event.args.ethEventId), txHash);
    }
  });

  log('Received: ', Object.keys(txEvents), crossChainTxMap.size > 0 ? crossChainTxMap.size / 2 : 0);
  return { txEvents, crossChainTxMap };
}

async function updateCrossChainTxStatuses(crossChainTxMap) {
  // Check the final status of cross chain transactions
  const crossChainTxFinalStatuses = await getCrossChainTxFinalStatuses(Array.from(crossChainTxMap.values()));

  crossChainTxFinalStatuses.forEach(event => {
    const txHash = crossChainTxMap.get(JSON.stringify(event.args.ethEventId));
    const currentTxStatus = crossChainTxMap.get(txHash);
    currentTxStatus.status = failureFilter.includes(event.name) ? transactionStatus.Rejected : transactionStatus.Processed;
    crossChainTxMap.set(txHash, currentTxStatus);
  });

  return crossChainTxMap;
}

async function getCrossChainTxFinalStatuses(txEvents) {
  const query = `query CrossChainTransactions { events(where: {
    name_in: ["${SUCCESS_CROSS_CHAIN_EVENT}", "${FAILED_CROSS_CHAIN_EVENT}"],
    AND: [
      { OR: [
      	${txEvents
          .map(
            txEvent =>
              `{args_jsonContains: "{\\"ethEventId\\": {\\"signature\\":\\"${txEvent.signature}\\",\\"transactionHash\\":\\"${txEvent.transactionHash}\\"}}"},`
          )
          .join('\n')}
      ]}
    ]},
    limit: ${txEvents.length}) {name args}}`;

  const response = await utils.axios.post(BLOCK_EXPLORER_BASE_URL, { query, operationName: 'GatewayApiStatus' });
  return response?.data?.data?.events || [];
}

function calculateTransactionStatus(txEvent, failureEvents, crossChainTxMap) {
  if (failureEvents.includes(txEvent.name)) {
    return transactionStatus.Rejected;
  }

  if (crossChainTxMap.has(txEvent.extrinsic.hash)) {
    return crossChainTxMap.get(txEvent.extrinsic.hash).status;
  }

  return transactionStatus.Processed;
}

function log(state, txHashes, crossChainCount) {
  if (txHashes.length > 0) {
    console.info(`${state} ${txHashes.length} transaction statuses from graphQL ${
      crossChainCount ? '(' + crossChainCount + ' cross chain)' : ''
    }}
      - start tx: ${txHashes[0]}
      - end tx: ${txHashes[txHashes.length - 1]}`);
  } else {
    console.info(`${state} 0 transaction statuses from graphQL`);
  }
}
