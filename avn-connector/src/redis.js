const Redis = require('ioredis');
const Redlock = require('redlock');
const _ = require('lodash');
const config = require('multiconfig').load();
const log4js = require('log4js');
const log = log4js.getLogger();

const transactionObject = {
  senderAddress: 'senderAddress',
  senderNonce: 'senderNonce',
  status: 'status',
  blockNumber: 'blockNumber',
  transactionIndex: 'transactionIndex'
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
const TOTAL_TOKEN_NAMESPACE = 't.';
const COLLATORS_KEY = 'collators';
const STAKING_STAT_KEY = 'stakingStats';
const CHAIN_INFO_KEY = 'chainInfo';
const LIFTS_FROM_ETH_BLOCK_KEY = 'liftsFromBlock';
const ERA_KEY = 'era';
const LOWER_BLOCK_INDEX_KEY = 'lowerBlockIndex';
const LOWERS_FROM_AVN_BLOCK_KEY = 'lowersFromBlock';
const CLAIMED_LOWERS_FROM_AVN_BLOCK_KEY = 'claimedLowersFromBlock';
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
const NONCE_EXPIRY_IN_SECONDS = 10;
const TOTAL_TOKEN_EXPIRY_IN_SECONDS = 300; //10 minutes
const COLLATORS_EXPIRY_IN_SECONDS = 86400; //1 day
const STAKING_STAT_EXPIRY_IN_SECONDS = 86400; //1 day
const CHAIN_INFO_EXPIRY_IN_SECONDS = 86400; //1 day

let redisClient, redlock;

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

  redlock = new Redlock([redisClient], {
    driftFactor: 0.01,
    retryCount:  10,
    retryDelay:  50,
    retryJitter:  200
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

  if (await redisClient.exists(txHashOrRequestIdKey)) {
    log.error(`Key (${txHashOrRequestIdKey}) exists already, cannot add duplicate value.`);
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

  await redisClient
    .multi()
    .hset(transactionHashKey, buildTransactionJson(senderAddress, senderNonce, transactionStatus.Pending))
    .zadd(PENDING_TX_KEY.ALL, '+inf', transactionHash)
    .set(requestIdKey, transactionHash)
    .exec();
}

// This function should not be exposed outside the connector
async function updateTransactionStatusToFailed(requestId, transactionHash, senderAddress, senderNonce, reason) {
  const transactionHashKey = getKey(transactionHash);

  if (await redisClient.exists(transactionHashKey)) {
    await redisClient.hset(transactionHashKey, buildTransactionJson(senderAddress, senderNonce, reason));
  } else {
    await addFailedAvnTransaction(requestId, transactionHash, senderAddress, senderNonce, reason);
  }
}

// Returns null if txHashOrRequestIdKey is not found
async function getAvnTransaction(txHashOrRequestId) {
  const txHashOrRequestIdKey = getKey(txHashOrRequestId);
  const result = await redisClient.hgetall(txHashOrRequestIdKey);
  return Object.keys(result).length === 0 ? undefined : result;
}

async function resolvePendingAvnTransactions(transactions) {
  if (!transactions) {
    log.trace(`No transactions to update`);
    return;
  }

  log.trace(`Updating ${transactions.length} transactions`);
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

  const [_numExpired, numAwaitingCheck, txToCheckNext] = await redisClient
    .multi()
    .zremrangebyscore(PENDING_TX_KEY.CHECKING, '-inf', timeNow) // Expire any transactions that have been being checked for too long
    .zdiffstore(PENDING_TX_KEY.NEXT, 2, PENDING_TX_KEY.ALL, PENDING_TX_KEY.CHECKING) // Get transactions that are not currently being checked
    .nextzsubset(PENDING_TX_KEY.NEXT, PENDING_TX_KEY.CHECKING, MAX_PENDING_TX_TO_CHECK, expiry) // Update the expiry of the next subset to check and return it
    .exec();

  log.trace(`Transactions awaiting check: ${numAwaitingCheck[1]}\n`);
  log.trace(`Next transactions to check: ${txToCheckNext[1]}\n`);
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

async function lockNonce(senderAddress) {
  return await redlock.acquire([NONCE_NAMESPACE + senderAddress], 5000);
}

async function incrementNonce(senderAddress) {
  const nextNonce = await redisClient.incr(NONCE_NAMESPACE + senderAddress);
  // If the nonce does not exist (or has expired) redis will return an incremented 0 value, i.e.: 1
  return nextNonce === 1 ? undefined : nextNonce;
}

async function decrementNonce(senderAddress) {
  await redisClient.decr(NONCE_NAMESPACE + senderAddress);
}

async function setNonce(senderAddress, nonce) {
  await redisClient.setex(NONCE_NAMESPACE + senderAddress, NONCE_EXPIRY_IN_SECONDS, nonce);
}

async function extendNonceExpiry(senderAddress) {
  redisClient.expire(NONCE_NAMESPACE + senderAddress, NONCE_EXPIRY_IN_SECONDS);
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

async function setCheckLiftsFromEthBlock(blockNumber) {
  await redisClient.set(LIFTS_FROM_ETH_BLOCK_KEY, blockNumber);
}

async function getCheckLiftsFromEthBlock() {
  return await redisClient.get(LIFTS_FROM_ETH_BLOCK_KEY);
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
  const fromBlock = await redisClient.get(LOWERS_FROM_AVN_BLOCK_KEY);
  return fromBlock || 0;
}

async function setCheckClaimedLowersFromAvnBlock(blockNumber) {
  await redisClient.set(CLAIMED_LOWERS_FROM_AVN_BLOCK_KEY, blockNumber);
}

async function getCheckClaimedLowersFromAvnBlock() {
  const fromBlock = await redisClient.get(CLAIMED_LOWERS_FROM_AVN_BLOCK_KEY);
  return fromBlock || 0;
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
  lockNonce,
  incrementNonce,
  decrementNonce,
  setNonce,
  extendNonceExpiry,
  getNextTransactionsToCheck,
  resolvePendingAvnTransactions,
  getTransactionHashByRequestId,
  getCollatorsToNominate,
  setCollatorsToNominate,
  getStakingStats,
  setStakingStats,
  getChainInfo,
  setChainInfo,
  getCheckLiftsFromEthBlock,
  setCheckLiftsFromEthBlock,
  getTotalToken,
  setTotalToken,
  setRetrieveLowersFromAvnBlock,
  getRetrieveLowersFromAvnBlock,
  setCheckClaimedLowersFromAvnBlock,
  getCheckClaimedLowersFromAvnBlock,
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
  updateTransactionStatusToPending,
  updateTransactionStatusToFailed
};
