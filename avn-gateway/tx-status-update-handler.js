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
    console.info(`Getting ${transactionHashes.length} transaction statuses from chain indexer`);
    const blockExplorerResponse = await utils.axios.post(`${BLOCK_EXPLORER_BASE_URL}/transactions/bulk`, { transactionHashes });
    const response = blockExplorerResponse.data.data;

    if (response && response.length > 0) {
      console.info(`Recieved ${response.length} responses from chain indexer`);

      return response.map(tx => {
        return {
          transactionHash: tx.transactionHash,
          status: tx.isFailed === true ? transactionStatus.Rejected : transactionStatus.Processed,
          blockNumber: tx.blockNumber,
          index: tx.index,
          events: tx.events
        };
      });
    }
  } catch (error) {
    throw new Error(`Error getting transaction status from indexer: ${error}`);
  }
}
