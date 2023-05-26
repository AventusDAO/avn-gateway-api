const utils = require('/opt/utils.js');

const AVN_CONNECTOR_ENDPOINT = process.env.AVN_CONNECTOR_ENDPOINT;
const BLOCK_EXPLORER_BASE_URL = process.env.BLOCK_EXPLORER_BASE_URL;

// Make sure this is kept in sync with the state names defined in avn-connector/src/redis.js
const transactionStatus = {
  Processed: 'Processed',
  Rejected: 'Rejected'
};

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
    console.info(`Requesting ${transactionHashes.length} transaction statuses from graphQL`);
    const successFilter = ['System.ExtrinsicSuccess'];
    const failureFilter = ['System.ExtrinsicFailed', 'AvnProxy.InnerCallFailed', 'EthereumEvents.EventRejected'];
    // Any extrinsics for which we wish to capture the event output can be added to the eventArgsFilter:
    const eventArgsFilter = ['NftManager.SingleNftMinted', 'NftManager.BatchNftMinted', 'NftManager.BatchCreated'];
    const extrinsicFilter = successFilter.concat(failureFilter).concat(eventArgsFilter);
    const query = `query GatewayApiStatus { events(where: {extrinsic: {hash_in: ${JSON.stringify(transactionHashes)}}, name_in: ${JSON.stringify(extrinsicFilter)}}) { name args extrinsic { hash indexInBlock success block { height } } } }`;
    const response = await utils.axios.post(BLOCK_EXPLORER_BASE_URL, { query, variables: null, operationName: 'GatewayApiStatus' });
    const events = response.data.data.events;
    console.info(`Received ${events.length} transaction statuses from graphQL`);

    return events.map(event => {
      return {
        transactionHash: event.extrinsic.hash,
        status: failureFilter.includes(event.name) ? transactionStatus.Rejected : transactionStatus.Processed,
        blockNumber: event.extrinsic.block.height,
        index: event.extrinsic.indexInBlock,
        eventArgs: eventArgsFilter.includes(event.name) ? event.args : {}
      };
    });
  } catch (error) {
    throw new Error(`Error getting transaction status from indexer: ${error}`);
  }
}
