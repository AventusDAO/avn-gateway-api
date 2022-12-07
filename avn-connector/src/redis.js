const Redis = require('ioredis');
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
  SendingFailed: 'SendingFailed'
};

// This is required to avoid CROSSSLOT errors: https://aws.amazon.com/premiumsupport/knowledge-center/elasticache-crossslot-keys-error-redis/
const SLOT_PREFIX = '{gateway}:';
const NONCE_NAMESPACE = 'n.';
const SUMMARY_RANGE_NAMESPACE = 's.';
const TOTAL_TOKEN_NAMESPACE = 't.';
const VALIDATORS_KEY = 'validators';
const STAKING_STAT_KEY = 'stakingStats';
const CHAIN_INFO_KEY = 'chainInfo';
const LIFTS_FROM_BLOCK_KEY = 'liftsFromBlock';
const ERA_KEY = 'era';
const STAKER_PAYOUT_FLAG_KEY = 'payoutFlag';

const PENDING_TX_KEY = {
  ALL: `${SLOT_PREFIX}aTx`,
  CHECKING: `${SLOT_PREFIX}cTx`,
  NEXT: `${SLOT_PREFIX}nTx`
};

const MAX_PENDING_TX_TO_CHECK = 100;
const PENDING_TX_CHECKING_WINDOW_IN_SECONDS = 10;
const NONCE_EXPIRY_IN_SECONDS = 5;
const TOTAL_TOKEN_EXPIRY_IN_SECONDS = 300; //10 minutes
const VALIDATORS_EXPIRY_IN_SECONDS = 86400; //1 day
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

function getKey(key) {
  return `${SLOT_PREFIX}${key}`;
}

async function addFailedAvnTransaction(requestId, txHashOrRequestId, senderAddress, senderNonce) {
  const txHashOrRequestIdKey = getKey(txHashOrRequestId);
  const requestIdKey = getKey(requestId);

  if (await redisClient.exists(txHashOrRequestIdKey)) {
    throw new Error(`Key (${txHashOrRequestIdKey}) exists already, cannot add duplicate value.`);
  }

  await redisClient
    .multi()
    .hset(txHashOrRequestIdKey, buildTransactionJson(senderAddress, senderNonce, transactionStatus.SendingFailed))
    .set(requestIdKey, txHashOrRequestId)
    .exec();
}

async function addPendingAvnTransaction(requestId, transactionHash, senderAddress, senderNonce) {
  const transactionHashKey = getKey(transactionHash);
  const requestIdKey = getKey(requestId);

  if (await redisClient.exists(transactionHashKey)) {
    throw new Error(`Transaction hash (${transactionHashKey}) exists already, cannot add duplicate value.`);
  }

  await redisClient
    .multi()
    .hset(transactionHashKey, buildTransactionJson(senderAddress, senderNonce, transactionStatus.Pending))
    .zadd(PENDING_TX_KEY.ALL, '+inf', transactionHash)
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

    await redisClient.multi().hset(transactionHashKey, newValue).zrem(PENDING_TX_KEY.ALL, tx.transactionHash).exec();
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

async function getNextNonce(senderAddress) {
  const nextNonce = await redisClient.incr(NONCE_NAMESPACE + senderAddress);
  // If the nonce does not exist (or has expired) redis will return an incremented 0 value, i.e.: 1
  return nextNonce === 1 ? undefined : nextNonce;
}

async function resetNonce(senderAddress) {
  await redisClient.decr(NONCE_NAMESPACE + senderAddress);
}

async function setNonce(senderAddress, nonce) {
  await redisClient.setex(NONCE_NAMESPACE + senderAddress, NONCE_EXPIRY_IN_SECONDS, nonce.toString());
}

function refreshNonce(senderAddress) {
  redisClient.expire(NONCE_NAMESPACE + senderAddress, NONCE_EXPIRY_IN_SECONDS);
}

async function setValidatorsToNominate(validatorsJsonString) {
  await redisClient.setex(VALIDATORS_KEY, VALIDATORS_EXPIRY_IN_SECONDS, validatorsJsonString);
}

async function getValidatorsToNominate() {
  return await redisClient.get(VALIDATORS_KEY);
}

async function setStakingStats(stakingStatJsonString) {
  await redisClient.setex(STAKING_STAT_KEY, STAKING_STAT_EXPIRY_IN_SECONDS, stakingStatJsonString);
}

async function getStakingStats() {
  return await redisClient.get(STAKING_STAT_KEY);
}

async function setChainInfo(chainInfoJsonString) {
  await redisClient.setex(CHAIN_INFO_KEY, CHAIN_INFO_EXPIRY_IN_SECONDS, chainInfoJsonString);
}

async function getChainInfo() {
  return await redisClient.get(CHAIN_INFO_KEY);
}

async function setSummaryEthTxHash(summaryRange, ethTxHash) {
  await redisClient.set(SUMMARY_RANGE_NAMESPACE + summaryRange.join('_'), ethTxHash);
}

async function getSummaryEthTxHash(summaryRange) {
  return await redisClient.get(SUMMARY_RANGE_NAMESPACE + summaryRange.join('_'));
}

async function setCheckLiftsFromBlock(blockNumber) {
  await redisClient.set(LIFTS_FROM_BLOCK_KEY, blockNumber);
}

async function getCheckLiftsFromBlock() {
  return await redisClient.get(LIFTS_FROM_BLOCK_KEY);
}

async function setLastPayoutEra(era) {
  await redisClient.set(ERA_KEY, era);
}

async function getLastPayoutEra() {
  return await redisClient.get(ERA_KEY);
}

async function setTotalToken(token, total) {
  await redisClient.setex(TOTAL_TOKEN_NAMESPACE + token, TOTAL_TOKEN_EXPIRY_IN_SECONDS, total);
}

async function getTotalToken(token) {
  return await redisClient.get(TOTAL_TOKEN_NAMESPACE + token);
}

async function getStakerPayoutFlag() {
  return await redisClient.get(STAKER_PAYOUT_FLAG_KEY);
}

async function setStakerPayoutFlag(flag) {
  await redisClient.set(STAKER_PAYOUT_FLAG_KEY, flag);
}

module.exports = {
  connect,
  addPendingAvnTransaction,
  addFailedAvnTransaction,
  getAvnTransaction,
  getNextNonce,
  resetNonce,
  setNonce,
  refreshNonce,
  getNextTransactionsToCheck,
  resolvePendingAvnTransactions,
  getTransactionHashByRequestId,
  getValidatorsToNominate,
  setValidatorsToNominate,
  getStakingStats,
  setStakingStats,
  getChainInfo,
  setChainInfo,
  getSummaryEthTxHash,
  setSummaryEthTxHash,
  getCheckLiftsFromBlock,
  setCheckLiftsFromBlock,
  getLastPayoutEra,
  setLastPayoutEra,
  getTotalToken,
  setTotalToken,
  getStakerPayoutFlag,
  setStakerPayoutFlag
};
