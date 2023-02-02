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

async function getLowers(account) {
  console.log(`\nProcessing lowers`);
  const { avnContract } = JSON.parse(await avn.getChainInfo());

  const latestPublishedBlock = await updateSummaries(avnContract);
  console.log(`\tLast published block: ${latestPublishedBlock}`);

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
      latestPublishedBlock = parseInt(summaries[i].toBlock);
    } else {
      summaries[i].published = false;
    }
  }

  await redis.setSummaries(summaries.map(s => JSON.stringify(s)));
  return latestPublishedBlock;
}

async function retrieveLatestLowerTransactions(latestPublishedBlock) {
  let retrieveFromBlock = parseInt((await redis.getRetrieveLowersFromBlock()) || 0);
  const lowerTransactions = await getLowerTransactions(retrieveFromBlock);

  console.log(`\tChecking for lowers from block: ${retrieveFromBlock}`);
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
      retrieveFromBlock = blockNumber + 1;
    }

    if (isHex(lowerTx.amount)) lowerTx.amount = hexToBn(lowerTx.amount).toString();
    const lowerData = { token: lowerTx.token, from: lowerTx.from, to: lowerTx.to, amount: lowerTx.amount, claimData: {} };
    await redis.setLowerData(txHash, JSON.stringify(lowerData));
    await redis.setBlockIndex(txHash, JSON.stringify({ blockNumber, index: lowerTx.index }));
  }

  await redis.setRetrieveLowersFromBlock(retrieveFromBlock.toString());
}

async function updateUnpublishedLowers(latestPublishedBlock) {
  const unpublished = (await redis.getUnpublishedLowers()) || [];

  console.log(`\tLowers not yet published to Ethereum: ${unpublished.length}`)
  for (let i = 0; i < unpublished.length; i++) {
    const txHash = unpublished[i];
    const { blockNumber } = JSON.parse(await redis.getBlockIndex(txHash));

    if (blockNumber <= latestPublishedBlock) {
      await redis.removeUnpublishedLower(txHash);
      await redis.addAwaitingClaimDataLower(txHash);
    }
  }
}

async function updateAwaitingClaimDataLowers() {
  const awaiting = (await redis.getAwaitingClaimDataLowers()) || [];
  const summaries = (await redis.getSummaries()).map(s => JSON.parse(s));
  let error = false;

  console.log(`\tLowers awaiting leaf and path data from RPC node: ${awaiting.length}`)
  for (let i = 0; i < awaiting.length; i++) {
    const txHash = awaiting[i];
    const blockIndex = JSON.parse(await redis.getBlockIndex(txHash));
    if (blockIndex === null) break;
    const { blockNumber, index } = blockIndex;
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
            const lowerData = JSON.parse(await redis.getLowerData(txHash));
            lowerData.claimData.leaf = '0x' + Buffer.from(rpcData.encoded_leaf).toString('hex');
            lowerData.claimData.merklePath = '[' + rpcData.merkle_path.join(',').replace(/'/g, '') + ']';
            await redis.setLowerData(txHash, JSON.stringify(lowerData));
            await redis.removeAwaitingClaimDataLower(txHash);
            await redis.deleteBlockIndex(txHash);
            await redis.addUnclaimedLower(txHash);
          } catch (e) {
            console.error(`💔 Error processing lowers awaiting claimed data: `, e);
            error = true;
          }
        } else {
          console.warn(`\t  🚨 Unable to get RPC lower data for: range[${fromBlock} - ${toBlock}], tx:(${blockNumber}, ${index})`);
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
  const unclaimed = (await redis.getUnclaimedLowers()) || [];
  console.log(`\tPublished lowers waiting to be claimed: ${unclaimed.length} `);

  for (let i = 0; i < unclaimed.length; i++) {
    const txHash = unclaimed[i];
    const lowerData = JSON.parse(await redis.getLowerData(txHash));
    const leafHash = keccakAsHex(lowerData.claimData.leaf);

    if (claimedLowers.includes(leafHash)) {
      await redis.removeUnclaimedLower(txHash);
      await redis.deleteLowerData(txHash);
    }
  }

  await redis.setCheckClaimedLowersFromBlock(nextFromBlock);
}

async function getLowerTransactions(blockNumber) {
  const response = await axios.post(`${AVN_EXPLORER_URL}/transactions/lowers?blockNumberFrom=${blockNumber}&limit=10000`);

  // handle nulls
  return response.data ? (response.data.data || []) : [];
}

async function getLowersForAccount(account) {
  const unpublished = await redis.getUnpublishedLowers();
  const awaiting = await redis.getAwaitingClaimDataLowers();
  const unclaimed = await redis.getUnclaimedLowers();
  const outstanding = unpublished.concat(awaiting).concat(unclaimed);
  let lowers = [];

  for (let i = 0; i < outstanding.length; i++) {
    const lowerData = JSON.parse(await redis.getLowerData(outstanding[i]));
    if (lowerData && lowerDataContainsAccount(lowerData, account)) {
      lowers.push(lowerData);
    }
  }

  console.log(`\tTotal outstanding lowers: ${outstanding.length}`);
  console.log(`\tFound ${lowers.length} lowers relating to account ${account}`);
  return lowers;
}

function lowerDataContainsAccount(lowerData, account) {
  return lowerData.from.toLowerCase() === account.toLowerCase() || lowerData.to.toLowerCase() === account.toLowerCase();
}

module.exports = {
  getLowers
};
