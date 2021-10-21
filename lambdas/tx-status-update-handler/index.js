const EC2 = require('../common/resources.json').ec2_endpoint;
const axios = require('axios');

const MAX_TX_TO_PROCESS = 1000
const BLOCK_EXPLORER_BASE_URL = `https://avn.sandbox.aventus.io:3000/transactions/all`

// Make sure this is kept in sync with the state names defined in ec2/src/redis.js
const transactionStates = {
  Processed: 'Processed',
  Rejected: 'Rejected'
}

exports.handler = async (_event) => {
  try {
    const response = {
      statusCode: 200,
      body: JSON.stringify(await processRequest())
    };

    return response;
  } catch(err) {
    const errorResponse = {
      statusCode: 500,
      error: {message: err.message}
    }

    return errorResponse
  }
};

async function processRequest() {
  // Get transactions that need resolving (i.e. that are pending)
  const pendingTransactionHashes = (await axios.get(EC2 + 'pendingTransactions')).data

  if (!pendingTransactionHashes || pendingTransactionHashes.length == 0) {
    console.log(`No pending transactions to resolve`)
    return;
  }

  const transactions = await getTransactionsStatusFromIndexer(pendingTransactionHashes)

  // resolve them in the database
  await axios.post(EC2 + 'resolvePendingTransactions', {transactions})
}

async function getTransactionsStatusFromIndexer(transactionHashes) {
  try {
    let res = await axios.post(`${BLOCK_EXPLORER_BASE_URL}`, {"transactionHashes": transactionHashes})
    const response = res.data

    if (response && response.length > 0) {
      return response.map(tx => {
        return {
          transactionHash: tx.transactionHash,
          state: tx.isFailed === true ? transactionStates.Rejected : transactionStates.Processed,
          blockNumber: tx.blockNumber
        }
      })
    }
  } catch (error) {
    throw new Error(`Error getting transaction state from indexer: ${error}`)
  }
}