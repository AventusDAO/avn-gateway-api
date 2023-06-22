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
    log('Requesting', transactionHashes);

    const successFilter = ['System.ExtrinsicSuccess'];
    const failureFilter = ['System.ExtrinsicFailed', 'AvnProxy.InnerCallFailed', 'EthereumEvents.EventRejected'];
    // Any extrinsics for which we wish to capture event output can be added to the argsFilter:
    const argsFilter = ['NftManager.SingleNftMinted', 'NftManager.BatchNftMinted', 'NftManager.BatchCreated'];
    const extrinsicFilter = successFilter.concat(failureFilter).concat(argsFilter);
    const limit = Math.min(extrinsicFilter.length * transactionHashes.length, 2500);
    const query = `query GatewayApiStatus { events(where: {extrinsic: {hash_in: ${JSON.stringify(transactionHashes)}},
        name_in: ${JSON.stringify(extrinsicFilter)}}, limit: ${limit})
        { name args extrinsic { hash indexInBlock success block { height } } } }`;
    const response = await utils.axios.post(BLOCK_EXPLORER_BASE_URL, { query, operationName: 'GatewayApiStatus' });
    const events = response.data.data.events;

    // The same transaction can have multiple events returned for it. Here we reduce them
    // by having any failure events or events with args supplant success events:
    const txStatuses = {};
    events.forEach(event => {
      const txHash = event.extrinsic.hash;
      if (failureFilter.concat(argsFilter).includes(event.name) || txHash in txStatuses === false) txStatuses[txHash] = event;
    });

    log('Received', Object.keys(txStatuses));

    return Object.values(txStatuses).map(status => {
      return {
        transactionHash: status.extrinsic.hash,
        status: failureFilter.includes(status.name) ? transactionStatus.Rejected : transactionStatus.Processed,
        blockNumber: status.extrinsic.block.height,
        index: status.extrinsic.indexInBlock,
        eventArgs: argsFilter.includes(status.name)
          ? Object.fromEntries(
              Object.entries(status.args).map(([k, v]) =>
                ['batchNftId', 'nftId'].includes(k) ? [k, '0x' + new utils.BN(v).toString(16)] : [k, v]
              )
            )
          : {}
      };
    });
  } catch (error) {
    throw new Error(`Error getting transaction status from indexer: ${error}`);
  }
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
