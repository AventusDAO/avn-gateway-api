const { keccakAsHex } = require('@polkadot/util-crypto');
const axios = require('axios');
const avn = require('./avn');
const redis = require('./redis');
const tier1 = require('./tier1');
const { hexToBn, isHex } = require('@polkadot/util');
const config = require('multiconfig').load();
const log4js = require('log4js');
const log = log4js.getLogger();

const AVN_EXPLORER_URL = config.avnExplorerUrl;

let now;
let lowerAccount;
function timing(x) {
  const was = now;
  now = Date.now();
  console.log('LOWER TIMING', lowerAccount, x, now - was);
}

async function getLowers(account) {
  now = Date.now();
  lowerAccount = account;
  timing('A');
  console.log(`\nProcessing lowers`);
  const { avnContract } = await redis.getChainInfo();
  timing('B');

  const latestPublishedBlock = await updateSummaries(avnContract);
  timing('H');
  console.log(`\tLatest block published: ${latestPublishedBlock}`);

  await retrieveLatestLowerTransactions(latestPublishedBlock);
  await updateUnpublishedLowers(latestPublishedBlock);
  await updateAwaitingClaimDataLowers();
  await updateUnclaimedLowers(avnContract, account);
  return await getLowersForAccount(account);
}

async function updateSummaries(avnContract) {
  timing('C');
  const summaries = await avn.getSummaries();
  timing('D');
  const publishedRoots = await tier1.getPublishedRoots(avnContract);
  timing('E');
  let latestPublishedBlock = 0;

  for (let i = 0; i < summaries.length; i++) {
    if (publishedRoots.includes(summaries[i].rootHash)) {
      summaries[i].published = true;
      latestPublishedBlock = summaries[i].toBlock;
    } else {
      summaries[i].published = false;
    }
  }

  timing('F');
  await redis.setSummaries(summaries);
  timing('G');
  return latestPublishedBlock;
}

async function retrieveLatestLowerTransactions(latestPublishedBlock) {
  timing('I');
  let retrieveFromBlock = await redis.getRetrieveLowersFromAvnBlock();
  timing('J');
  const lowerTransactions = await getLowerTransactions(retrieveFromBlock);
  timing('M');

  console.log(`\tChecking for lowers from block ${retrieveFromBlock} - found ${lowerTransactions.length}`);
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
    await redis.setLowerData(txHash, lowerData);
    const blockIndex = { blockNumber, index: lowerTx.index };
    await redis.setBlockIndex(txHash, blockIndex);
  }
  timing('N');

  await redis.setRetrieveLowersFromAvnBlock(retrieveFromBlock);
  timing('O');
}

async function updateUnpublishedLowers(latestPublishedBlock) {
  timing('P');
  const unpublished = await redis.getUnpublishedLowers();

  timing('Q');
  console.log(`\tLowers not yet published: ${unpublished.length}`);
  for (let i = 0; i < unpublished.length; i++) {
    const txHash = unpublished[i];
    const { blockNumber } = await redis.getBlockIndex(txHash);

    if (blockNumber <= latestPublishedBlock) {
      await redis.removeUnpublishedLower(txHash);
      await redis.addAwaitingClaimDataLower(txHash);
    }
  }
  timing('R');
}

async function updateAwaitingClaimDataLowers() {
  timing('S');
  const awaiting = await redis.getAwaitingClaimDataLowers();
  timing('T');
  const summaries = await redis.getSummaries();
  timing('U');
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

  timing('V');
  if (error === true) {
    throw new Error('Error processing AwaitingClaimDataLowers');
  }
}

async function updateUnclaimedLowers(avnContract, account) {
  timing('W');
  const claimedLowers = await tier1.getLatestClaimedLowers(avnContract);
  let claimed = 0;
  timing('X');

  if (claimedLowers.length > 0) {
    const unclaimed = await redis.getUnclaimedLowers();
    timing('Y');

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
  }

  timing('Z');
  console.log(`\tRecently claimed: ${claimed} `);
  timing('AA');
}

async function getLowerTransactions(fromBlock) {
  timing('K');
  const generateId = (block, index) =>
    [block.toString().padStart(10, '0'), index.toString().padStart(6, '0'), '00000'].join('-');
  const txLimit = 50;
  let newLowers = [];
  let lowers = [];
  let fromId = generateId(fromBlock, 0);

  // Loop to retrieve lowers so as not to exceed the indexer limit:
  do {
    newLowers = await getLowersFromIndexer(fromId, txLimit);
    if (newLowers.length > 0) {
      lowers = lowers.concat(newLowers);
      // Update the starting position (lowers are ordered so the last entry is always the most recent):
      fromId = generateId(lowers[lowers.length - 1].blockNumber, parseInt(lowers[lowers.length - 1].index + 1));
    }
  } while (newLowers.length > 0);

  timing('L');
  return lowers;
}

async function getLowersFromIndexer(fromId, txLimit) {
  try {
    const query = `query ConnectorLower { events( where: { name_eq: "TokenManager.TokenLowered", call: { id_gte: "${fromId}" } },
        limit: ${txLimit}, orderBy: id_ASC) { args extrinsic { hash id indexInBlock block { height } } } }`;
    const response = await axios.post(AVN_EXPLORER_URL, { query: query, operationName: 'ConnectorLower' });
    const events = response.data.data.events;
    return events.map(event => ({
      txHash: event.extrinsic.hash,
      blockNumber: event.extrinsic.block.height.toString(),
      index: event.extrinsic.indexInBlock.toString(),
      token: event.args.tokenId,
      amount: event.args.amount,
      from: event.args.sender,
      to: event.args.t1Recipient
    }));
  } catch (error) {
    console.error(`💔 Error running next lower tx hashes query: `, error);
    return [];
  }
}

async function getLowersForAccount(account) {
  timing('AB');
  const unpublished = await redis.getUnpublishedLowers();
  timing('AC');
  const awaiting = await redis.getAwaitingClaimDataLowers();
  timing('AD');
  const unclaimed = await redis.getUnclaimedLowers();
  timing('AE');
  const outstanding = unpublished.concat(awaiting).concat(unclaimed);
  timing('AF');
  let lowers = [];

  for (let i = 0; i < outstanding.length; i++) {
    const lowerData = await redis.getLowerData(outstanding[i]);
    if (lowerData && lowerDataContainsAccount(lowerData, account)) {
      lowers.push(lowerData);
    }
  }

  timing('AG');
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