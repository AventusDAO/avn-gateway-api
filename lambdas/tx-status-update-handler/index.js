const EC2 = require('../common/resources.json').ec2_endpoint;
const axios = require('axios');

const MAX_TX_TO_PROCESS = 100
const BLOCK_EXPLORER_BASE_URL = `https://avn.sandbox.aventus.io:3000/transactions/`

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
  const pendingTransactionHashes = (await axios.get(EC2 + 'pendingTransactions')).data;

  if (!pendingTransactionHashes || pendingTransactionHashes.length == 0) {
    console.log(`No pending transactions to resolve`)
    return;
  }

  const txPromises = pendingTransactionHashes.slice(0, MAX_TX_TO_PROCESS).map(txHash => getTransactionStatusFromIndexer(txHash));
  const transactions = (await Promise.allSettled(txPromises)).filter(p => p.status === 'fulfilled' && p.value !== undefined).map(p => p.value);

  // resolve them in the database
  await axios.post(EC2 + 'resolvePendingTransactions', {transactions})
}

async function getTransactionStatusFromIndexer(transactionHash) {
  try {
    let res = await axios.get(`${BLOCK_EXPLORER_BASE_URL}${transactionHash}`)
    const response = res.data.data.hits.hits

    if (response.length > 0 && response[0]._source) {
      const data = response[0]._source
      const state = data.isFailed === true ? transactionStates.Rejected : transactionStates.Processed
      return {transactionHash, state, blockNumber: data.blockNumber }
    }

    console.log(`Transaction hash ${transactionHash} not found in chain indexer.`)

  } catch (error) {
    throw new Error(`Error getting transaction state for transaction hash ${transactionHash}: ${error}`)
  }
}