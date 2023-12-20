const Redis = require('ioredis');
const _ = require('lodash');
const config = require('multiconfig').load();
const log4js = require('log4js');
const log = log4js.getLogger();

const transactionObject = {
  senderAddress: 'senderAddress',
  senderNonce: 'senderNonce',
  status: 'status',
  blockNumber: 'blockNumber',
  transactionIndex: 'transactionIndex',
  eventArgs: 'eventArgs'
};

const transactionStatus = {
  Pending: 'Pending',
  Processed: 'Processed',
  Rejected: 'Rejected',
  SendingFailed: 'SendingFailed',
  PayerRefused: 'PayerRefused',
  AwaitingToSend: 'AwaitingToSend'
};

// This is required to avoid CROSSSLOT errors: https://aws.amazon.com/premiumsupport/knowledge-center/elasticache-crossslot-keys-error-redis/
const SLOT_PREFIX = '{gateway}:';
const NONCE_NAMESPACE = 'n.';
const PAYER_NONCE_NAMESPACE = 'pn.';
const TOTAL_TOKEN_NAMESPACE = 't.';
const COLLATORS_KEY = 'collators';
const STAKING_STAT_KEY = 'stakingStats';
const CHAIN_INFO_KEY = 'chainInfo';
const LIFTS_FROM_TIER1_BLOCK_KEY = 'liftsFromBlock';
const ERA_KEY = 'era';
const LOWER_BLOCK_INDEX_KEY = 'lowerBlockIndex';
const LOWERS_FROM_AVN_BLOCK_KEY = 'lowersFromBlock';
const CLAIMED_LOWERS_FROM_TIER1_BLOCK_KEY = 'claimedLowersFromBlock';
const PUBLISHED_ROOTS_FROM_TIER1_BLOCK_KEY = 'publishedRootsFromBlock';
const UNPUBLISHED_LOWERS_KEY = 'lowersUnpublished';
const AWAITING_CLAIM_DATA_LOWERS_KEY = 'lowersAwaitingData';
const UNCLAIMED_LOWERS_KEY = 'lowersUnclaimed';
const LOWER_DATA_KEY = 'lowerData';
const SUMMARIES_KEY = 'summaries';

const PENDING_TX_KEY = {
  ALL: `${SLOT_PREFIX}aTx`,
  CHECKING: `${SLOT_PREFIX}cTx`,
  NEXT: `${SLOT_PREFIX}nTx`
};

const MAX_PENDING_TX_TO_CHECK = 250;
const PENDING_TX_CHECKING_WINDOW_IN_SECONDS = 5;
const NONCE_EXPIRY_IN_SECONDS = 120;
const TOTAL_TOKEN_EXPIRY_IN_SECONDS = 300; //10 minutes
const COLLATORS_EXPIRY_IN_SECONDS = 86400; //1 day
const STAKING_STAT_EXPIRY_IN_SECONDS = 86400; //1 day
const CHAIN_INFO_EXPIRY_IN_SECONDS = 86400; //1 day

let redisClient;

async function connect() {
  if ('redis' in config) {
    log.info(`Attempting to connect to Redis database on ${config.redis.url}:${config.redis.port}`);
    redisClient = new Redis.Cluster([{ port: config.redis.port, host: config.redis.url }]);
    log.info(
      'Connected to Redis database:\n',
      (await redisClient.hello()).map((e, i) => (i % 2 == 0 ? e + ':' : e + ', ')).join('')
    );
  } else {
    redisClient = new Redis();
  }

  // Reads a range from sorted set KEYS[1] and adds it to sorted set KEYS[2]
  // The range is defined by score, and includes all elements with score value between ARGV[1] and ARGV[2]
  // We extract the elements with their scores with ZRANGE ... BYSCORE WITHSCORES.
  // This returns sequences of <Key Score>
  // But to insert / update these with zadd, we have to invert the order, and send
  // ZADD ... <Score Key> <Score Key> ...
  // We invert the array pair-wise in the foor loop
  // The result returned is divided by 2, because ZRANGE is returning (member, score) pairs
  redisClient.defineCommand('addzrangebyscore', {
    numberOfKeys: 2,
    lua: `local subset = redis.call('ZRANGE', KEYS[1], ARGV[1], ARGV[2], 'BYSCORE', 'WITHSCORES')
          local subsetCopy = {unpack(subset)}
          if table.getn(subset) > 0 then
            for i=1,table.getn(subset)/2 do
              local pos1 = 2 * i
              local pos2 = pos1 - 1
              local swap = subset[pos1]
              subset[pos1] = subset[pos2]
              subset[pos2] = swap
            end
            table.insert(subset, 1, 'ZADD')
            table.insert(subset, 2, KEYS[2])
            redis.call(unpack(subset))
            return table.getn(subsetCopy)/2
          else
            return 0
          end`
  });

  redisClient.defineCommand('nextzsubset', {
    numberOfKeys: 2,
    lua: `local subset = redis.call('ZRANGE', KEYS[1], 0, ARGV[1]-1)
          local subsetCopy = {unpack(subset)}
          if table.getn(subset) > 0 then
            for i=1,table.getn(subset)
              do table.insert(subset, i*2-1, ARGV[2])
            end
            table.insert(subset, 1, 'ZADD')
            table.insert(subset, 2, KEYS[2])
            redis.call(unpack(subset))
            return subsetCopy
          else
            return {}
          end`
  });
}

function dataToJsonString(data) {
  if (_.isString(data)) {
    throw new Error('Data is already stringified: ' + data);
  } else {
    return JSON.stringify(data);
  }
}

function getKey(key) {
  return `${SLOT_PREFIX}${key}`;
}

// There is no transaction hash at this point, so use a hash of the request Id
async function addNewAvnTransaction(requestId, requestIdHash) {
  const transactionHashKey = getKey(requestIdHash);

  log.trace(`[redis][addNewAvnTransaction] - requestId: ${requestId}, transactionHash: ${requestIdHash}`);

  if (await redisClient.exists(transactionHashKey)) {
    log.error(`Transaction hash (${transactionHashKey}) exists already, cannot add duplicate value.`);
    return;
  }

  const requestIdKey = getKey(requestId);
  await redisClient
    .multi()
    .hset(transactionHashKey, buildTransactionJson(undefined, undefined, transactionStatus.AwaitingToSend))
    .set(requestIdKey, requestIdHash)
    .exec();
}

async function addFailedAvnTransaction(requestId, txHashOrRequestId, senderAddress, senderNonce, reason) {
  const txHashOrRequestIdKey = getKey(txHashOrRequestId);
  const requestIdKey = getKey(requestId);

  log.trace(
    `[redis][addFailedAvnTransaction] - requestId: ${requestId}, transactionHash: ${txHashOrRequestId}, senderAddress: ${senderAddress}, senderNonce: ${senderNonce}, reason: ${reason}`
  );

  if (await redisClient.exists(txHashOrRequestIdKey)) {
    log.warn(`Updating status of transaction: ${txHashOrRequestId} (${requestId}) to ${reason}`);
    await redisClient.hset(txHashOrRequestIdKey, buildTransactionJson(senderAddress, senderNonce, reason));
    return;
  }

  await redisClient
    .multi()
    .hset(txHashOrRequestIdKey, buildTransactionJson(senderAddress, senderNonce, reason))
    .set(requestIdKey, txHashOrRequestId)
    .exec();
}

// When a transaction is pending, it will have a txHash for the first time.
// This function should not be exposed outside the connector
async function updateTransactionStatusToPending(requestId, transactionHash, senderAddress, senderNonce) {
  const transactionHashKey = getKey(transactionHash);
  const requestIdKey = getKey(requestId);

  log.trace(
    `[redis][updateTransactionStatusToPending] - requestId: ${requestId}, transactionHash: ${transactionHash}, senderAddress: ${senderAddress}, senderNonce: ${senderNonce}`
  );

  // Add new transactions to the queue, with the current time as their score. New transactions will be picked after
  // current transactions that have not been polled yet
  const age = Date.now();
  await redisClient
    .multi()
    .hset(transactionHashKey, buildTransactionJson(senderAddress, senderNonce, transactionStatus.Pending))
    .zadd(PENDING_TX_KEY.ALL, age, transactionHash)
    .set(requestIdKey, transactionHash)
    .exec();
}

// Returns null if txHashOrRequestIdKey is not found
async function getAvnTransaction(txHashOrRequestId) {
  const txHashOrRequestIdKey = getKey(txHashOrRequestId);
  const result = await redisClient.hgetall(txHashOrRequestIdKey);
  return Object.keys(result).length === 0 ? undefined : result;
}

async function resolvePendingAvnTransactions(transactions) {
  if (!transactions) {
    log.trace(`[redis]No transactions to update`);
    return;
  }

  log.trace(`[redis]Updating ${transactions.length} transactions`);
  for (const tx of transactions) {
    const transactionHashKey = getKey(tx.transactionHash);

    if (![transactionStatus.Processed, transactionStatus.Rejected].includes(tx.status)) {
      log.warn({ message: 'invalid status, ignoring request', transactionHashKey: transactionHashKey, txStatus: tx.status });
      continue;
    }

    const newValue = {};
    newValue[transactionObject.status] = tx.status;
    newValue[transactionObject.blockNumber] = tx.blockNumber;
    newValue[transactionObject.transactionIndex] = tx.index;
    newValue[transactionObject.eventArgs] = dataToJsonString(tx.eventArgs);

    await redisClient
      .multi()
      .hset(transactionHashKey, newValue)
      .zrem(PENDING_TX_KEY.ALL, tx.transactionHash)
      .zrem(PENDING_TX_KEY.CHECKING, tx.transactionHash)
      .zrem(PENDING_TX_KEY.NEXT, tx.transactionHash)
      .exec();
  }
}

async function getNextTransactionsToCheck() {
  const timeNow = Date.now();
  const expiry = timeNow + PENDING_TX_CHECKING_WINDOW_IN_SECONDS * 1000;

  const [numUpdated, numExpired, numAwaitingCheck, txToCheckNext] = await redisClient
    .multi()
    .addzrangebyscore(PENDING_TX_KEY.CHECKING, PENDING_TX_KEY.ALL, '-inf', timeNow) // Update expiry of any transaction in ALL that has expired while being checked
    .zremrangebyscore(PENDING_TX_KEY.CHECKING, '-inf', timeNow) // Expire the transactions updated in the previous step
    .zdiffstore(PENDING_TX_KEY.NEXT, 2, PENDING_TX_KEY.ALL, PENDING_TX_KEY.CHECKING) // Get transactions that are not currently being checked
    .nextzsubset(PENDING_TX_KEY.NEXT, PENDING_TX_KEY.CHECKING, MAX_PENDING_TX_TO_CHECK, expiry) // Update the expiry of the next subset to check and return it
    .exec();

  if (numUpdated[1] !== numExpired[1]) {
    log.warn(`[redis]Count of expired (${numExpired[1]}) and updated (${numUpdated[1]}) transactions differs\n`);
  }
  log.trace(`[redis]Transactions with updated expiry: ${numUpdated[1]}\n`);
  log.trace(`[redis]Transactions awaiting check: ${numAwaitingCheck[1]}\n`);
  log.trace(`[redis]Next transactions to check: ${txToCheckNext[1]}\n`);
  return txToCheckNext[1];
}

async function getTransactionHashByRequestId(requestId) {
  const requestIdKey = getKey(requestId);
  return await redisClient.get(requestIdKey);
}

function buildTransactionJson(senderAddress, senderNonce, status) {
  const result = {};
  result[transactionObject.senderAddress] = senderAddress;
  result[transactionObject.senderNonce] = senderNonce || '';
  result[transactionObject.status] = status;
  return result;
}

async function getNextNonce(senderAddress) {
  const nonce = await redisClient.get(NONCE_NAMESPACE + senderAddress);
  return nonce == null ? undefined : parseInt(nonce);
}

async function setNextNonce(senderAddress, nonce) {
  await redisClient.setex(NONCE_NAMESPACE + senderAddress, NONCE_EXPIRY_IN_SECONDS, nonce.toString());
}

async function getNextPayerNonce(payerAddress) {
  const nonce = await redisClient.get(PAYER_NONCE_NAMESPACE + payerAddress);
  return nonce == null ? undefined : parseInt(nonce);
}

async function setNextPayerNonce(payerAddress, nonce) {
  await redisClient.setex(PAYER_NONCE_NAMESPACE + payerAddress, NONCE_EXPIRY_IN_SECONDS, nonce.toString());
}

async function setCollatorsToNominate(collators) {
  await redisClient.setex(COLLATORS_KEY, COLLATORS_EXPIRY_IN_SECONDS, dataToJsonString(collators));
}

async function getCollatorsToNominate() {
  const collators = await redisClient.get(COLLATORS_KEY);
  return collators ? JSON.parse(collators) : undefined;
}

async function setStakingStats(stakingStats) {
  await redisClient.setex(STAKING_STAT_KEY, STAKING_STAT_EXPIRY_IN_SECONDS, dataToJsonString(stakingStats));
}

async function getStakingStats() {
  const stakingStats = await redisClient.get(STAKING_STAT_KEY);
  return stakingStats ? JSON.parse(stakingStats) : undefined;
}

async function setChainInfo(chainInfo) {
  await redisClient.setex(CHAIN_INFO_KEY, CHAIN_INFO_EXPIRY_IN_SECONDS, dataToJsonString(chainInfo));
}

async function getChainInfo() {
  const chainInfo = await redisClient.get(CHAIN_INFO_KEY);
  return chainInfo ? JSON.parse(chainInfo) : undefined;
}

async function setLiftsFromTier1Block(blockNumber) {
  await redisClient.set(LIFTS_FROM_TIER1_BLOCK_KEY, blockNumber);
}

async function getLiftsFromTier1Block() {
  const blockNumber = await redisClient.get(LIFTS_FROM_TIER1_BLOCK_KEY);
  return blockNumber ? parseInt(blockNumber) : 0;
}

async function setTotalToken(token, total) {
  await redisClient.setex(TOTAL_TOKEN_NAMESPACE + token, TOTAL_TOKEN_EXPIRY_IN_SECONDS, total);
}

async function getTotalToken(token) {
  return await redisClient.get(TOTAL_TOKEN_NAMESPACE + token);
}

async function setRetrieveLowersFromAvnBlock(blockNumber) {
  await redisClient.set(LOWERS_FROM_AVN_BLOCK_KEY, blockNumber);
}

async function getRetrieveLowersFromAvnBlock() {
  const blockNumber = await redisClient.get(LOWERS_FROM_AVN_BLOCK_KEY);
  return blockNumber ? parseInt(blockNumber) : 0;
}

async function setClaimedLowersFromTier1Block(blockNumber) {
  await redisClient.set(CLAIMED_LOWERS_FROM_TIER1_BLOCK_KEY, blockNumber);
}

async function getClaimedLowersFromTier1Block() {
  const blockNumber = await redisClient.get(CLAIMED_LOWERS_FROM_TIER1_BLOCK_KEY);
  return blockNumber ? parseInt(blockNumber) : 0;
}

async function setPublishedRootsFromTier1Block(blockNumber) {
  await redisClient.set(PUBLISHED_ROOTS_FROM_TIER1_BLOCK_KEY, blockNumber);
}

async function getPublishedRootsFromTier1Block() {
  const blockNumber = await redisClient.get(PUBLISHED_ROOTS_FROM_TIER1_BLOCK_KEY);
  return blockNumber ? parseInt(blockNumber) : 0;
}

async function setBlockIndex(txHash, blockIndex) {
  await redisClient.set(LOWER_BLOCK_INDEX_KEY + txHash, dataToJsonString(blockIndex));
}

async function deleteBlockIndex(txHash) {
  await redisClient.del(LOWER_BLOCK_INDEX_KEY + txHash);
}

async function getBlockIndex(txHash) {
  const blockIndex = await redisClient.get(LOWER_BLOCK_INDEX_KEY + txHash);
  return blockIndex ? JSON.parse(blockIndex) : { blockNumber: -1, index: -1 };
}

async function addUnpublishedLower(txHash) {
  await redisClient.sadd(UNPUBLISHED_LOWERS_KEY, txHash);
}

async function removeUnpublishedLower(txHash) {
  await redisClient.srem(UNPUBLISHED_LOWERS_KEY, txHash);
}

async function getUnpublishedLowers() {
  const unpublished = await redisClient.smembers(UNPUBLISHED_LOWERS_KEY);
  return unpublished || [];
}

async function addAwaitingClaimDataLower(txHash) {
  await redisClient.sadd(AWAITING_CLAIM_DATA_LOWERS_KEY, txHash);
}

async function removeAwaitingClaimDataLower(txHash) {
  await redisClient.srem(AWAITING_CLAIM_DATA_LOWERS_KEY, txHash);
}

async function getAwaitingClaimDataLowers() {
  const awaiting = await redisClient.smembers(AWAITING_CLAIM_DATA_LOWERS_KEY);
  return awaiting || [];
}

async function addUnclaimedLower(txHash) {
  await redisClient.sadd(UNCLAIMED_LOWERS_KEY, txHash);
}

async function removeUnclaimedLower(txHash) {
  await redisClient.srem(UNCLAIMED_LOWERS_KEY, txHash);
}

async function getUnclaimedLowers() {
  const unclaimed = await redisClient.smembers(UNCLAIMED_LOWERS_KEY);
  return unclaimed || [];
}

async function setSummaries(summaries) {
  await redisClient.del(SUMMARIES_KEY);
  await redisClient.rpush(
    SUMMARIES_KEY,
    summaries.map(s => dataToJsonString(s))
  );
}

async function getSummaries() {
  const summaries = await redisClient.lrange(SUMMARIES_KEY, 0, -1);
  return summaries ? summaries.map(s => JSON.parse(s)) : [];
}

async function setLowerData(txHash, lowerData) {
  await redisClient.set(LOWER_DATA_KEY + txHash, dataToJsonString(lowerData));
}

async function deleteLowerData(txHash) {
  await redisClient.del(LOWER_DATA_KEY + txHash);
}

async function getLowerData(txHash) {
  const lowerData = await redisClient.get(LOWER_DATA_KEY + txHash);
  return lowerData ? JSON.parse(lowerData) : undefined;
}

module.exports = {
  connect,
  addNewAvnTransaction,
  addFailedAvnTransaction,
  getAvnTransaction,
  getNextNonce,
  getNextPayerNonce,
  setNextNonce,
  setNextPayerNonce,
  getNextTransactionsToCheck,
  resolvePendingAvnTransactions,
  getTransactionHashByRequestId,
  getCollatorsToNominate,
  setCollatorsToNominate,
  getStakingStats,
  setStakingStats,
  getChainInfo,
  setChainInfo,
  getLiftsFromTier1Block,
  setLiftsFromTier1Block,
  getTotalToken,
  setTotalToken,
  setRetrieveLowersFromAvnBlock,
  getRetrieveLowersFromAvnBlock,
  setClaimedLowersFromTier1Block,
  getClaimedLowersFromTier1Block,
  setPublishedRootsFromTier1Block,
  getPublishedRootsFromTier1Block,
  setBlockIndex,
  deleteBlockIndex,
  getBlockIndex,
  addUnpublishedLower,
  removeUnpublishedLower,
  getUnpublishedLowers,
  addAwaitingClaimDataLower,
  removeAwaitingClaimDataLower,
  getAwaitingClaimDataLowers,
  addUnclaimedLower,
  removeUnclaimedLower,
  getUnclaimedLowers,
  setSummaries,
  getSummaries,
  setLowerData,
  deleteLowerData,
  getLowerData,
  transactionStatus,
  updateTransactionStatusToPending
};
