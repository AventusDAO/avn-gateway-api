const axios = require('axios')

const AVN_CONNECTOR_ENDPOINT = process.env.AVN_CONNECTOR_ENDPOINT
const BLOCK_EXPLORER_BASE_URL = 'https://avn.stargate.aventus.io:3000/transactions/bulk'

// Make sure this is kept in sync with the state names defined in ec2/src/redis.js
const transactionStatus = {
  Processed: 'Processed',
  Rejected: 'Rejected'
}

exports.handler = async _event => {
  try {
    const response = {
      statusCode: 200,
      body: JSON.stringify(await processRequest())
    }

    return response
  } catch (err) {
    const errorResponse = {
      statusCode: 500,
      error: { message: err.message }
    }

    return errorResponse
  }
}

async function processRequest() {
  // Get transactions that need resolving (i.e. that are pending)
  const pendingTransactionHashes = (await axios.get(AVN_CONNECTOR_ENDPOINT + 'pendingTransactions')).data

  if (!pendingTransactionHashes || pendingTransactionHashes.length == 0) {
    console.log('No pending transactions to resolve')
    return
  }

  const transactions = await getTransactionsStatusFromIndexer(pendingTransactionHashes)

  // resolve them in the database
  await axios.post(AVN_CONNECTOR_ENDPOINT + 'resolvePendingTransactions', { transactions })
}

async function getTransactionsStatusFromIndexer(transactionHashes) {
  try {
    console.log(`Getting ${transactionHashes.length} transaction statuses from chain indexer`)
    let res = await axios.post(`${BLOCK_EXPLORER_BASE_URL}`, { transactionHashes: transactionHashes })
    const response = res.data.data

    if (response && response.length > 0) {
      console.log(`Recieved ${response.length} responses from chain indexer`)

      return response.map(tx => {
        return {
          transactionHash: tx.transactionHash,
          status: tx.isFailed === true ? transactionStatus.Rejected : transactionStatus.Processed,
          blockNumber: tx.blockNumber
        }
      })
    }
  } catch (error) {
    throw new Error(`Error getting transaction status from indexer: ${error}`)
  }
}
