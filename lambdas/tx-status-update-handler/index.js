const EC2 = require('../common/resources.json').ec2_endpoint;
const axios = require('axios');

const MAX_TX_TO_PROCESS = 50
const BLOCK_EXPLORER_BASE_URL = `https://avn.sandbox.aventus.io:3000/transactions/`

// Make sure this is kept in sync with the state names defined in ec2/src/redis.js
const transactionStates = {
  Processed: 'Processed',
  Rejected: 'Rejected'
}

exports.handler = async (event) => {
  const response = {
    statusCode: 200,
    body: JSON.stringify(await processRequest(event.body))
  };
  return response;
};

async function processRequest(requestObject) {
  try {
    const transactions = []
    // Get transactions that need resolving (i.e. that are pending)
    const pendingTransactionHashs = response = await axios.get(EC2 + 'pendingTransactions');

    if (pendingTransactionHashs.length == 0) {
      console.log(`No pending transactions to resolve`)
      return;
    }

    for (const txHash of pendingTransactionHashs.slice(0, MAX_TX_TO_PROCESS)) {
      // try to get the status from the indexer
      const tx = await getTransactionStatusFromIndexer(txHash)
      if (tx) {
        transactions.push(tx)
      }
    }

    // resolve them in the database
    await axios.post(EC2 + 'resolvePendingTransactions', {transactions})
  } catch (err) {
    console.error(`Error resolving pending transactions: ${err}`)
  }
}

async function getTransactionStatusFromIndexer(transactionHash) {
  try {
    let res = await axios.get(`${BLOCK_EXPLORER_BASE_URL}${transactionHash}`)
    console.log(`Indexer found ${JSON.stringify(res.data.data.hits.total.value)} record(s) for hash ${transactionHash}`)
    const response = res.data.data.hits.hits

    if (response.length > 0 && response[0]._source) {
      const state = response[0]._source.isFailed === true ? transactionStates.Rejected : transactionStates.Processed
      return {transactionHash, state, blockNumber: response[0]._source.blockNumber }
    }

  } catch (error) {
    log.error(`Error getting transaction state for transaction hash ${transactionHash}: ${error}`)
  }
}