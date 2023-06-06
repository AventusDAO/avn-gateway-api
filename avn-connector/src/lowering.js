const { keccakAsHex } = require('@polkadot/util-crypto');
const axios = require('axios');
const avn = require('./avn');
const redis = require('./redis');
const ethereum = require('./ethereum');
const { hexToBn, isHex } = require('@polkadot/util');
const config = require('multiconfig').load();
const log4js = require('log4js');
const log = log4js.getLogger();

const AVN_EXPLORER_URL = config.avnExplorerUrl;
const LOWER_CHUNK_SIZE = 10;

async function getLowers(account) {
  console.log(`\nProcessing lowers`);
  const { avnContract } = await redis.getChainInfo();

  const latestPublishedBlock = await updateSummaries(avnContract);

  console.log(`\tLatest block published to Ethereum: ${latestPublishedBlock}`);
  await retrieveLatestLowerTransactions(latestPublishedBlock);
  await updateUnpublishedLowers(latestPublishedBlock);
  await updateAwaitingClaimDataLowers();
  await updateUnclaimedLowers(avnContract, account);
  return await getLowersForAccount(account);
}

async function updateSummaries(avnContract) {
  const summaries = await avn.getSummaries();
  const publishedRoots = await ethereum.getPublishedRoots(avnContract);
  let latestPublishedBlock = 0;

  for (let i = 0; i < summaries.length; i++) {
    if (publishedRoots.includes(summaries[i].rootHash)) {
      summaries[i].published = true;
      latestPublishedBlock = summaries[i].toBlock;
    } else {
      summaries[i].published = false;
    }
  }

  await redis.setSummaries(summaries);
  return latestPublishedBlock;
}

async function retrieveLatestLowerTransactions(latestPublishedBlock) {
  let lowerTransactions = [];

  do {
    let retrieveFromBlock = await redis.getRetrieveLowersFromAvnBlock();
    console.log(`\tChecking for lowers from block: ${retrieveFromBlock}`);
    lowerTransactions = await getLowerTransactions(retrieveFromBlock);
    console.log(`\tNew lower transactions found: ${lowerTransactions.length}`);

    for (let i = 0; i < lowerTransactions.length; i++) {
      const lowerTx = lowerTransactions[i];
      const txHash = lowerTx.txHash;
      const blockNumber = parseInt(lowerTx.blockNumber);

      if (blockNumber > latestPublishedBlock) {
        await redis.addUnpublishedLower(txHash);
      } else {
        await redis.addAwaitingClaimDataLower(txHash);
      }

      if (blockNumber > retrieveFromBlock) {
        retrieveFromBlock = blockNumber;
      }

      if (isHex(lowerTx.amount)) lowerTx.amount = hexToBn(lowerTx.amount).toString();
      const lowerData = { token: lowerTx.token, from: lowerTx.from, to: lowerTx.to, amount: lowerTx.amount, claimData: {} };
      await redis.setLowerData(txHash, lowerData);
      const blockIndex = { blockNumber, index: lowerTx.index };
      await redis.setBlockIndex(txHash, blockIndex);
    }

    await redis.setRetrieveLowersFromAvnBlock(retrieveFromBlock);
  } while (lowerTransactions.length === LOWER_CHUNK_SIZE);
}

async function updateUnpublishedLowers(latestPublishedBlock) {
  const unpublished = await redis.getUnpublishedLowers();

  console.log(`\tLowers not yet published to Ethereum: ${unpublished.length}`);
  for (let i = 0; i < unpublished.length; i++) {
    const txHash = unpublished[i];
    const { blockNumber } = await redis.getBlockIndex(txHash);

    if (blockNumber <= latestPublishedBlock) {
      await redis.removeUnpublishedLower(txHash);
      await redis.addAwaitingClaimDataLower(txHash);
    }
  }
}

async function updateAwaitingClaimDataLowers() {
  const awaiting = await redis.getAwaitingClaimDataLowers();
  const summaries = await redis.getSummaries();
  let error = false;

  console.log(`\tChecking for claim data: ${awaiting.length}`);
  for (let i = 0; i < awaiting.length; i++) {
    const txHash = awaiting[i];
    const { blockNumber, index } = await redis.getBlockIndex(txHash);
    if (blockNumber === -1) break;
    const summaryData = summaries.find(s => blockNumber >= s.fromBlock && blockNumber <= s.toBlock);

    if (summaryData) {
      const { fromBlock, toBlock } = summaryData;
      if (summaryData.published === false) {
        console.warn(`\t  🚨 Unpublished summary for: range[${fromBlock} - ${toBlock}], tx:(${blockNumber}, ${index})`);
      } else {
        let rpcData = await avn.getLowerDataFromRpc(fromBlock, toBlock, blockNumber, index);
        if (!rpcData.isEmpty) {
          try {
            rpcData = JSON.parse(Buffer.from(rpcData, 'hex').toString());
            const lowerData = await redis.getLowerData(txHash);
            lowerData.claimData.leaf = '0x' + Buffer.from(rpcData.encoded_leaf).toString('hex');
            lowerData.claimData.merklePath = '[' + rpcData.merkle_path.join(',').replace(/'/g, '') + ']';
            await redis.setLowerData(txHash, lowerData);
            await redis.removeAwaitingClaimDataLower(txHash);
            await redis.deleteBlockIndex(txHash);
            await redis.addUnclaimedLower(txHash);
          } catch (e) {
            console.error(`💔 Error processing lowers awaiting claimed data: `, e);
            error = true;
          }
        } else {
          console.warn(
            `\t  🚨 Unable to get RPC lower data for: range[${fromBlock} - ${toBlock}], tx:(${blockNumber}, ${index})`
          );
        }
      }
    }
  }

  if (error === true) {
    throw new Error('Error processing AwaitingClaimDataLowers');
  }
}

async function updateUnclaimedLowers(avnContract, account) {
  const { claimedLowers, nextFromBlock } = await ethereum.getLatestClaimedLowers(avnContract);
  const unclaimed = await redis.getUnclaimedLowers();
  let claimed = 0;

  for (let i = 0; i < unclaimed.length; i++) {
    const txHash = unclaimed[i];
    const lowerData = await redis.getLowerData(txHash);
    const leafHash = keccakAsHex(lowerData.claimData.leaf);

    if (claimedLowers.includes(leafHash)) {
      await redis.removeUnclaimedLower(txHash);
      await redis.deleteLowerData(txHash);
      claimed++;
    }
  }

  console.log(`\tRecently claimed lowers: ${unclaimed.length} `);
  console.log(`\tLowers still waiting to be claimed: ${unclaimed.length - claimed} `);
  await redis.setCheckClaimedLowersFromAvnBlock(nextFromBlock);
}

async function getLowerTransactions(fromBlock) {
  const lowerFilter = ['TokenManager.TokenLowered'];
  const failureFilter = ['System.ExtrinsicFailed', 'AvnProxy.InnerCallFailed'];
  let lowerTxHashes = [];
  let lowerTransactions = [];

  try {
    const query = `query ConnectorLower1 { events(where: { extrinsic: { block: { height_gte: ${fromBlock} }},
      name_in:${JSON.stringify(lowerFilter)} }, limit: ${LOWER_CHUNK_SIZE}, orderBy: block_height_ASC) { extrinsic { hash }}}`;
    const response = await axios.post(AVN_EXPLORER_URL, { query: query, operationName: 'ConnectorLower1' });
    lowerTxHashes = response.data.data.events.map(event => event.extrinsic.hash);
  } catch (error) {
    console.error(`💔 Error running lower query 1: `, error);
  }

  const extrinsics = failureFilter.concat(lowerFilter);
  const limit = lowerTxHashes.length * extrinsics.length;

  try {
    const query = `query ConnectorLower2 { events(where: { extrinsic: { hash_in:${JSON.stringify(lowerTxHashes)} },
      name_in: ${JSON.stringify(extrinsics)} }, limit: ${limit}) { name args extrinsic { hash indexInBlock block { height }}}}`;
    const response = await axios.post(AVN_EXPLORER_URL, { query: query, operationName: 'ConnectorLower2' });
    const events = response.data.data.events;

    const failedLowers = events.reduce((failed, event) => {
      if (failureFilter.includes(event.name)) {
        failed.push(event.extrinsic.hash);
      }
      return failed;
    }, []);

    lowerTransactions = events.reduce((successfulLowers, event) => {
      const txHash = event.extrinsic.hash;
      if (txHash in failedLowers === false) {
        successfulLowers.push({
          txHash: txHash,
          blockNumber: event.extrinsic.block.height,
          index: event.extrinsic.indexInBlock,
          amount: event.args.amount,
          from: event.args.sender,
          to: event.args.t1Recipient
        });
      }
      return successfulLowers;
    }, []);

  } catch (error) {
    console.error(`💔 Error running lower query 2: `, error);
  }

  return lowerTransactions;
}

async function getLowersForAccount(account) {
  const unpublished = await redis.getUnpublishedLowers();
  const awaiting = await redis.getAwaitingClaimDataLowers();
  const unclaimed = await redis.getUnclaimedLowers();
  const outstanding = unpublished.concat(awaiting).concat(unclaimed);
  let lowers = [];

  for (let i = 0; i < outstanding.length; i++) {
    const lowerData = await redis.getLowerData(outstanding[i]);
    if (lowerData && lowerDataContainsAccount(lowerData, account)) {
      lowers.push(lowerData);
    }
  }

  console.log(`\tTotal lowers outstanding: ${outstanding.length}`);
  console.log(`\tFound ${lowers.length} lowers relating to account ${account}`);
  return lowers;
}

function lowerDataContainsAccount(lowerData, account) {
  return lowerData.from.toLowerCase() === account.toLowerCase() || lowerData.to.toLowerCase() === account.toLowerCase();
}

module.exports = {
  getLowers
};
