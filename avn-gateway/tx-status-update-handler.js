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
const NEW_CROSS_CHAIN_EVENT = 'EthereumEvents.EthereumEventAdded';
const SUCCESS_CROSS_CHAIN_EVENT = 'EthereumEvents.EventAccepted';
const FAILED_CROSS_CHAIN_EVENT = 'EthereumEvents.EventRejected';

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

  const transactions = await getTransactionsStatusFromIndexer(pendingTransactionHashes);
  await utils.axios.post(AVN_CONNECTOR_ENDPOINT + 'resolvePendingTransactions', { transactions });
}

async function getTransactionsStatusFromIndexer(transactionHashes) {
  try {
    log('Requesting', transactionHashes);

    const crossChainFilter = [NEW_CROSS_CHAIN_EVENT];
    const successFilter = ['System.ExtrinsicSuccess'];
    const failureFilter = ['System.ExtrinsicFailed', 'AvnProxy.InnerCallFailed', 'EthereumEvents.EventRejected'];
    // Any extrinsics for which we wish to capture event output can be added to the argsFilter:
    const argsFilter = [
      'NftManager.SingleNftMinted',
      'NftManager.BatchNftMinted',
      'NftManager.BatchCreated',
      'TokenManager.LowerRequested'
    ];

    const extrinsicFilter = successFilter.concat(failureFilter).concat(argsFilter).concat(crossChainFilter);
    const limit = Math.min(extrinsicFilter.length * transactionHashes.length, TX_LIMIT);
    const query = `query GatewayApiStatus { events(where: {extrinsic: {hash_in: ${JSON.stringify(transactionHashes)}},
        name_in: ${JSON.stringify(extrinsicFilter)}}, limit: ${limit})
        { name args extrinsic { hash indexInBlock success block { height } } } }`;

    const response = await utils.axios.post(BLOCK_EXPLORER_BASE_URL, { query, operationName: 'GatewayApiStatus' });
    const events = response.data.data.events;

    // The same transaction can have multiple events returned for it. Here we reduce them
    // by having any failure events or events with args supplant success events:
    const txEvents = {};
    const crossChainTransactions = {};

    events.forEach(event => {
      const txHash = event.extrinsic.hash;
      if (failureFilter.concat(argsFilter).includes(event.name) || txHash in txEvents === false) {
        txEvents[txHash] = event;
      }

      if (event.name === NEW_CROSS_CHAIN_EVENT) {
        // we have a successfull new cross chain transaction, set the status to validating
        crossChainTransactions[txHash] = event;
        crossChainTransactions[txHash].status = transactionStatus.Validating
      }
    });

    log('All transactions - Received: ', Object.keys(txEvents));
    log('Cross chain transactions - Received: ', Object.keys(crossChainTransactions));

    // Check the status of cross chain events, one at a time
    // TODO: check if there a performance issue here or try to concatenate them with an OR in GQL
    for (const [txHash, tx] of Object.entries(crossChainTransactions)) {
      const status = await getCrossChainTransactionStatus(tx.args.ethEventId);

      if (status) {
        // We have a status so update it
        crossChainTransactions[txHash].status = status
      }
    }

    return Object.values(txEvents).map(txEvent => {
      let status;

      if (failureFilter.includes(txEvent.name)) {
        status = transactionStatus.Rejected
      } else {
        if (crossChainTransactions[txEvent.extrinsic.hash]?.status) {
          status = crossChainTransactions[txEvent.extrinsic.hash].status
        } else {
          status = transactionStatus.Processed
        }
      }

      return {
        transactionHash: txEvent.extrinsic.hash,
        status,
        blockNumber: txEvent.extrinsic.block.height,
        index: txEvent.extrinsic.indexInBlock,
        eventArgs: argsFilter.includes(txEvent.name) ? txEvent.args : {}
      };
    });
  } catch (error) {
    throw new Error(`Error getting transaction status from indexer: ${error}`);
  }
}

async function getCrossChainTransactionStatus(txEvent) {
  const query = `query CrossChainTransactions { events(where: {
    name_in: ["${SUCCESS_CROSS_CHAIN_EVENT}", "${FAILED_CROSS_CHAIN_EVENT}"],
    args_jsonContains: "{\\"ethEventId\\": {\\"signature\\":\\"${txEvent.signature}\\",\\"transactionHash\\":\\"${txEvent.transactionHash}\\"}}"
    },
  limit: 1) {id}}`

  const response = await utils.axios.post(BLOCK_EXPLORER_BASE_URL, { query, operationName: 'GatewayApiStatus' });
  if (response?.data?.data?.events && response?.data?.data?.events.length > 0) {
    return response?.data?.data?.events[0].name === SUCCESS_CROSS_CHAIN_EVENT ? transactionStatus.Processed : transactionStatus.Rejected
  }

  return transactionStatus.Validating
}

function log(state, txHashes) {
  if (txHashes.length > 0) {
    console.info(`${state} ${txHashes.length} transaction statuses from graphQL
      - start tx: ${txHashes[0]}
      - end tx: ${txHashes[txHashes.length - 1]}`);
  } else {
    console.info(`${state} 0 transaction statuses from graphQL`);
  }
}