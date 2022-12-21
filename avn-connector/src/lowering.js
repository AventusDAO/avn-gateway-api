const { keccakAsHex } = require('@polkadot/util-crypto');
const axios = require('axios');
const avn = require('./avn');
const redis = require('./redis');
const ethereum = require('./ethereum');
const config = require('multiconfig').load();
const log4js = require('log4js');
const log = log4js.getLogger();

const AVN_EXPLORER_URL = config.avnExplorerUrl;

async function getLowers(account) {
  const { avnContract } = JSON.parse(await avn.getChainInfo());

  const latestPublishedBlock = await getLatestPublishedBlock();
  await updatePublishedSummaries(avnContract, latestPublishedBlock);
  await retrieveLatestLowerTransactions(latestPublishedBlock);
  await updateUnpublishedLowers(latestPublishedBlock);
  await updateAwaitingClaimDataLowers();
  await updateUnclaimedLowers(avnContract);
  return await getLowersForAccount(account);
}

async function getLatestPublishedBlock() {
  const latestSummary = JSON.parse(await redis.getLatestPublishedSummary());

  if (latestSummary) {
    return parseInt(latestSummary.toBlock);
  }

  return 0;
}

async function updatePublishedSummaries(avnContract, latestPublishedBlock) {
  const summaries = await avn.getSummaries();
  const newSummaries = [];

  for (let i = 0; i < summaries.length; i++) {
    const { fromBlock, toBlock, rootHash, isValid } = summaries[i];
    console.log(`\n[updatePublishedSummaries] fromBlock: ${fromBlock}, toBlock: ${toBlock}, rootHash: ${rootHash}, isValid: ${isValid}, latestPublishedBlock: ${latestPublishedBlock}`);
    if (isValid && fromBlock > latestPublishedBlock && await ethereum.rootIsPublished(avnContract, rootHash)) {
      newSummaries.push({ fromBlock, toBlock });
    }
  }

  if (newSummaries.length > 0) {
    newSummaries.sort((a,b) => (a.fromBlock < b.fromBlock) ? -1 : ((b.fromBlock > a.fromBlock) ? 1 : 0));

    console.trace(`\nStoring ${newSummaries.length} processed summaries in Redis`);
    await redis.appendPublishedSummaries(newSummaries.map(s => JSON.stringify(s)));
  }
}

async function retrieveLatestLowerTransactions(latestPublishedBlock) {
  let retrieveFromBlock = parseInt((await redis.getRetrieveLowersFromBlock()) || 0);
  const lowerTransactions = await getLowerTransactions(retrieveFromBlock);

  console.log(`\n   - lowerTransactions.length = ${lowerTransactions.length}, details: ${JSON.stringify(lowerTransactions)}`);

  for (let i = 0; i < lowerTransactions.length; i++) {
    const lowerTx = lowerTransactions[i];
    const txHash = lowerTx.txHash;
    const blockNumber = parseInt(lowerTx.blockNumber);

    console.log(`blockNumber: ${blockNumber}, latestPublishedBlock: ${latestPublishedBlock}, blockNumber > latestPublishedBlock = ${blockNumber > latestPublishedBlock}`)
    if (blockNumber > latestPublishedBlock) {
      console.log(`Unpublished lower found: ${txHash}`)
      await redis.addUnpublishedLower(txHash);
    } else {
      console.log(`Lower awaiting data found: ${txHash}`)
      await redis.addLowerAwaitingData(txHash);
    }

    console.log(`blockNumber: ${blockNumber}, retrieveFromBlock: ${retrieveFromBlock}, blockNumber > retrieveFromBlock = ${blockNumber > retrieveFromBlock}`)
    if (blockNumber > retrieveFromBlock) {
      retrieveFromBlock = blockNumber + 1;
    }

    const lowerData = { token: lowerTx.token, from: lowerTx.from, to: lowerTx.to, amount: lowerTx.amount, claimData: {} };
    await redis.setLowerData(txHash, JSON.stringify(lowerData));
    await redis.setBlockIndex(txHash, JSON.stringify({ blockNumber, index: lowerTx.index }));
  }

  console.log(`retrieveFromBlock: ${retrieveFromBlock}`)
  await redis.setRetrieveLowersFromBlock(retrieveFromBlock.toString());
}

async function updateUnpublishedLowers(latestPublishedBlock) {
  const unpublished = (await redis.getUnpublishedLowers()) || [];

  console.log(`Unpublished lowers`)
  for (let i = 0; i < unpublished.length; i++) {
    const txHash = unpublished[i];
    const { blockNumber } = JSON.parse(await redis.getBlockIndex(txHash));

    console.log(` - blockNumber: ${blockNumber}, latestPublishedBlock: ${latestPublishedBlock}`);
    if (blockNumber <= latestPublishedBlock) {
      await redis.removeUnpublishedLower(txHash);
      await redis.addAwaitingClaimDataLower(txHash);
    }
  }
}

async function updateAwaitingClaimDataLowers() {
  const awaiting = (await redis.getAwaitingClaimDataLowers()) || [];
  const summaries = (await redis.getPublishedSummaries()).map(s => JSON.parse(s));

  console.log(`\n Awaiting claimed lowers: ${awaiting.length}`)
  for (let i = 0; i < awaiting.length; i++) {
    const txHash = awaiting[i];
    const { blockNumber, index } = JSON.parse(await redis.getBlockIndex(txHash));
    const { fromBlock, toBlock } = summaries.find(s => blockNumber >= s.fromBlock && blockNumber <= s.toBlock);
    const rpcData = await api.rpc.lower.data(fromBlock, toBlock, blockNumber, index);

    if (rpcData !== '') {
      rpcData = JSON.parse(Buffer.from(rpcData, 'hex').toString());
      const lowerData = JSON.parse(await redis.getLowerData(txHash));
      lowerData.claimData.leaf = '0x' + Buffer.from(rpcData.encoded_leaf).toString('hex');
      lowerData.claimData.merklePath = '[' + rpcData.merkle_path.join(',').replace(/'/g, '') + ']';
      await redis.setLowerData(txHash, JSON.stringify(lowerData));
      await redis.removeLowerAwaitingData(txHash);
      await redis.deleteBlockIndex(txHash);
      await redis.addUnclaimedLower(txHash);
    }
  }
}

async function updateUnclaimedLowers(avnContract) {
  const unclaimed = (await redis.getUnclaimedLowers()) || [];

  for (let i = 0; i < unclaimed.length; i++) {
    const txHash = unclaimed[i];
    const lowerData = JSON.parse(await redis.getLowerData(txHash));
    const leafHash = keccakAsHex(lowerData.claimData.leaf);

    if (await ethereum.lowerIsClaimed(avnContract, leafHash)) {
      await redis.removeUnclaimedLower(txHash);
      await redis.deleteLowerData(txHash);
    }
  }
}

async function getLowerTransactions(blockNumber) {
  console.log(`Getting lower transactions for block ${blockNumber}`);
  console.log(`   url: ${AVN_EXPLORER_URL}`);
  const response = await axios.get(`${AVN_EXPLORER_URL}/transactions/lowers/?blockNumber=84087`);
  //const response = await axios.post(`${AVN_EXPLORER_URL}/transactions/lowers`, {blockNumberFrom: blockNumber});

  console.log(`\n   - Lowers found: ${JSON.stringify(response.data)}`);
  return response.data || [];
}


async function getLowersForAccount(account) {
  const unpublished = await redis.getUnpublishedLowers();
  const awaiting = await redis.getAwaitingClaimDataLowers();
  const unclaimed = await redis.getUnclaimedLowers();
  const outstanding = unpublished.concat(awaiting).concat(unclaimed);
  let lowers = [];

  for (let i = 0; i < outstanding.length; i++) {
    const lowerData = JSON.parse(await redis.getLowerData(outstanding[i]));

    if (lowerData.from === account || lowerData.to === account) {
      lowers.push(lowerData);
    }
  }

  return lowers;
}

module.exports = {
  getLowers
};
