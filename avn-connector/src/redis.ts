import Redis from 'ioredis';
import _ from 'lodash';
const config = require('multiconfig').load();
import log4js from 'log4js';

const log = log4js.getLogger();

interface Transaction {
  senderAddress: string;
  senderNonce: string;
  status: string;
  blockNumber: string;
  transactionIndex: string;
  eventArgs: string;
}

const transactionObject: Transaction = {
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
  AwaitingToSend: 'AwaitingToSend',
  Validating: 'Validating'
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
const LAST_LOWER_BLOCK_ID_FROM_AVN = SLOT_PREFIX + 'lwr_lastAvnBlock';
const WEBHOOKS_SENT_TX_KEY = 'txSent';

const LOWER_ID_PREFIX = SLOT_PREFIX + 'lwr_id_';
const LOWER_SENDER_PREFIX = SLOT_PREFIX + 'lwr_sender_';
const LOWER_RECIPIENT_PREFIX = SLOT_PREFIX + 'lwr_recipient_';
const LAST_CLAIMED_ETH_LOWER_BLOCK_PREFIX = 'lwr_eth_last_claimed';

// Autolower
const AUTOLOWER_RETRY_LIFETIME_NAMESPACE = 'al.';
const AUTOLOWERS_KEY = 'autolowers';
const AUTOLOWER_LOCK_KEY = 'autolowerLock';
const NEXT_T1_BLOCK_FOR_AUTOLOWER_KEY = 'nextT1BlockForAutolower';
const LATEST_LOWER_ID_FOR_AUTOLOWER_KEY = 'latestLowerIdForAutolower';
const AUTOLOWER_MAX_LOCK_IN_SECONDS = 600; // 10 minutes
const AUTOLOWER_RETRY_LIFETIME_SECONDS = 1209600; // 14 days

const PENDING_TX_KEY = {
  ALL: `${SLOT_PREFIX}aTx`,
  CHECKING: `${SLOT_PREFIX}cTx`,
  NEXT: `${SLOT_PREFIX}nTx`
};

const MAX_PENDING_TX_TO_CHECK = 250;
const PENDING_TX_CHECKING_WINDOW_IN_SECONDS = 5;
const NONCE_EXPIRY_IN_SECONDS = 120;
const TOTAL_TOKEN_EXPIRY_IN_SECONDS = 300; //5 minutes
const COLLATORS_EXPIRY_IN_SECONDS = 86400; //1 day
const STAKING_STAT_EXPIRY_IN_SECONDS = 86400; //1 day
const CHAIN_INFO_EXPIRY_IN_SECONDS = 86400; //1 day

let redisClient: Redis.Redis | Redis.Cluster;

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

function dataToJsonString(data: any): string {
  if (_.isString(data)) {
    throw new Error('Data is already stringified: ' + data);
  } else {
    return JSON.stringify(data);
  }
}

function getKey(key: string): string {
  return `${SLOT_PREFIX}${key}`;
}

// There is no transaction hash at this point, so use a hash of the request Id
async function addNewAvnTransaction(requestId: string, requestIdHash: string): Promise<void> {
  const transactionHashKey = getKey(requestIdHash);

  log.trace(`[redis] [addNewAvnTransaction] - requestId: ${requestId}, transactionHash: ${requestIdHash}`);

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

async function addFailedAvnTransaction(
  requestId: string,
  txHashOrRequestId: string,
  senderAddress: string,
  senderNonce: string,
  reason: string
): Promise<void> {
  const txHashOrRequestIdKey = getKey(txHashOrRequestId);
  const requestIdKey = getKey(requestId);

  log.trace(
    `[redis] [addFailedAvnTransaction] - requestId: ${requestId}, transactionHash: ${txHashOrRequestId}, senderAddress: ${senderAddress}, senderNonce: ${senderNonce}, reason: ${reason}`
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
async function updateTransactionStatusToPending(
  requestId: string,
  transactionHash: string,
  senderAddress: string,
  senderNonce: string
): Promise<void> {
  const transactionHashKey = getKey(transactionHash);
  const requestIdKey = getKey(requestId);

  log.trace(
    `[redis] [updateTransactionStatusToPending] - requestId: ${requestId}, transactionHash: ${transactionHash}, senderAddress: ${senderAddress}, senderNonce: ${senderNonce}`
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
async function getAvnTransaction(txHashOrRequestId: string): Promise<Record<string, string> | undefined> {
  const txHashOrRequestIdKey = getKey(txHashOrRequestId);
  const result = await redisClient.hgetall(txHashOrRequestIdKey);
  return Object.keys(result).length === 0 ? undefined : result;
}

async function resolvePendingAvnTransactions(transactions: any[]): Promise<void> {
  if (!transactions) {
    log.trace(`[redis] No transactions to update`);
    return;
  }

  log.trace(`[redis] Updating ${transactions.length} transactions`);
  for (const tx of transactions) {
    const transactionHashKey = getKey(tx.transactionHash);

    if (![transactionStatus.Processed, transactionStatus.Rejected, transactionStatus.Validating].includes(tx.status)) {
      log.warn({ message: 'invalid status, ignoring request', transactionHash: tx.transactionHash, txStatus: tx.status });
      continue;
    }

    const newValue: Record<string, any> = {};
    newValue[transactionObject.status] = tx.status;
    newValue[transactionObject.blockNumber] = tx.blockNumber;
    newValue[transactionObject.transactionIndex] = tx.index;
    newValue[transactionObject.eventArgs] = dataToJsonString(tx.eventArgs);

    if (tx.status === transactionStatus.Validating) {
      log.trace(`[redis] Updating tx status to validated: txHash: ${tx.transactionHash}`);
      // make sure we don't accidentally overwrite an end state or re-write the same state
      const pendingTx = await redisClient.hgetall(transactionHashKey);
      if (![transactionStatus.Processed, transactionStatus.Rejected, transactionStatus.Validating].includes(pendingTx.status)) {
        await redisClient.hset(transactionHashKey, newValue);
      }
    } else {
      await redisClient
        .multi()
        .hset(transactionHashKey, newValue)
        .zrem(PENDING_TX_KEY.ALL, tx.transactionHash)
        .zrem(PENDING_TX_KEY.CHECKING, tx.transactionHash)
        .zrem(PENDING_TX_KEY.NEXT, tx.transactionHash)
        .exec();
    }
  }
}

async function getNextTransactionsToCheck(): Promise<string[]> {
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
    log.warn(`[redis] Count of expired (${numExpired[1]}) and updated (${numUpdated[1]}) transactions differs\n`);
  }
  log.trace(`[redis] Transactions with updated expiry: ${numUpdated[1]}\n`);
  log.trace(`[redis] Transactions awaiting check: ${numAwaitingCheck[1]}\n`);
  log.trace(`[redis] Next transactions to check: ${txToCheckNext[1]}\n`);
  return txToCheckNext[1];
}

async function getTransactionHashByRequestId(requestId: string): Promise<string | null> {
  const requestIdKey = getKey(requestId);
  return await redisClient.get(requestIdKey);
}

function buildTransactionJson(senderAddress: string | undefined, senderNonce: string | undefined, status: string): Record<string, string> {
  const result: Record<string, string> = {};
  result[transactionObject.senderAddress] = senderAddress || '';
  result[transactionObject.senderNonce] = senderNonce || '';
  result[transactionObject.status] = status;
  return result;
}

async function getNextNonce(senderAddress: string): Promise<number | undefined> {
  const nonce = await redisClient.get(NONCE_NAMESPACE + senderAddress);
  return nonce == null ? undefined : parseInt(nonce);
}

async function setNextNonce(senderAddress: string, nonce: number): Promise<void> {
  await redisClient.setex(NONCE_NAMESPACE + senderAddress, NONCE_EXPIRY_IN_SECONDS, nonce.toString());
}

async function getNextPayerNonce(payerAddress: string): Promise<number | undefined> {
  const nonce = await redisClient.get(PAYER_NONCE_NAMESPACE + payerAddress);
  return nonce == null ? undefined : parseInt(nonce);
}

async function setNextPayerNonce(payerAddress: string, nonce: number): Promise<void> {
  await redisClient.setex(PAYER_NONCE_NAMESPACE + payerAddress, NONCE_EXPIRY_IN_SECONDS, nonce.toString());
}

async function setCollatorsToNominate(collators: any): Promise<void> {
  await redisClient.setex(COLLATORS_KEY, COLLATORS_EXPIRY_IN_SECONDS, dataToJsonString(collators));
}

async function getCollatorsToNominate(): Promise<any | undefined> {
  const collators = await redisClient.get(COLLATORS_KEY);
  return collators ? JSON.parse(collators) : undefined;
}

async function setStakingStats(stakingStats: any): Promise<void> {
  await redisClient.setex(STAKING_STAT_KEY, STAKING_STAT_EXPIRY_IN_SECONDS, dataToJsonString(stakingStats));
}

async function getStakingStats(): Promise<any | undefined> {
  const stakingStats = await redisClient.get(STAKING_STAT_KEY);
  return stakingStats ? JSON.parse(stakingStats) : undefined;
}

async function setChainInfo(chainInfo: any): Promise<void> {
  await redisClient.setex(CHAIN_INFO_KEY, CHAIN_INFO_EXPIRY_IN_SECONDS, dataToJsonString(chainInfo));
}

async function getChainInfo(): Promise<any | undefined> {
  const chainInfo = await redisClient.get(CHAIN_INFO_KEY);
  return chainInfo ? JSON.parse(chainInfo) : undefined;
}

async function setLiftsFromTier1Block(blockNumber: number): Promise<void> {
  await redisClient.set(LIFTS_FROM_TIER1_BLOCK_KEY, blockNumber);
}

async function getLiftsFromTier1Block(): Promise<number> {
  const blockNumber = await redisClient.get(LIFTS_FROM_TIER1_BLOCK_KEY);
  return blockNumber ? parseInt(blockNumber) : 0;
}

async function setTotalToken(token: string, total: number): Promise<void> {
  await redisClient.setex(TOTAL_TOKEN_NAMESPACE + token, TOTAL_TOKEN_EXPIRY_IN_SECONDS, total.toString());
}

async function getTotalToken(token: string): Promise<string | null> {
  return await redisClient.get(TOTAL_TOKEN_NAMESPACE + token);
}

async function setRetrieveLowersFromAvnBlock(blockNumber: number): Promise<void> {
  await redisClient.set(LOWERS_FROM_AVN_BLOCK_KEY, blockNumber);
}

async function getRetrieveLowersFromAvnBlock(): Promise<number> {
  const blockNumber = await redisClient.get(LOWERS_FROM_AVN_BLOCK_KEY);
  return blockNumber ? parseInt(blockNumber) : 0;
}

async function setClaimedLowersFromTier1Block(blockNumber: number): Promise<void> {
  await redisClient.set(CLAIMED_LOWERS_FROM_TIER1_BLOCK_KEY, blockNumber);
}

async function getClaimedLowersFromTier1Block(): Promise<number> {
  const blockNumber = await redisClient.get(CLAIMED_LOWERS_FROM_TIER1_BLOCK_KEY);
  return blockNumber ? parseInt(blockNumber) : 0;
}

async function setPublishedRootsFromTier1Block(blockNumber: number): Promise<void> {
  await redisClient.set(PUBLISHED_ROOTS_FROM_TIER1_BLOCK_KEY, blockNumber);
}

async function getPublishedRootsFromTier1Block(): Promise<number> {
  const blockNumber = await redisClient.get(PUBLISHED_ROOTS_FROM_TIER1_BLOCK_KEY);
  return blockNumber ? parseInt(blockNumber) : 0;
}

async function setBlockIndex(txHash: string, blockIndex: any): Promise<void> {
  await redisClient.set(LOWER_BLOCK_INDEX_KEY + txHash, dataToJsonString(blockIndex));
}

async function deleteBlockIndex(txHash: string): Promise<void> {
  await redisClient.del(LOWER_BLOCK_INDEX_KEY + txHash);
}

async function getBlockIndex(txHash: string): Promise<any> {
  const blockIndex = await redisClient.get(LOWER_BLOCK_INDEX_KEY + txHash);
  return blockIndex ? JSON.parse(blockIndex) : { blockNumber: -1, index: -1 };
}

async function addUnpublishedLower(txHash: string): Promise<void> {
  await redisClient.sadd(UNPUBLISHED_LOWERS_KEY, txHash);
}

async function removeUnpublishedLower(txHash: string): Promise<void> {
  await redisClient.srem(UNPUBLISHED_LOWERS_KEY, txHash);
}

async function getUnpublishedLowers(): Promise<string[]> {
  const unpublished = await redisClient.smembers(UNPUBLISHED_LOWERS_KEY);
  return unpublished || [];
}

async function addAwaitingClaimDataLower(txHash: string): Promise<void> {
  await redisClient.sadd(AWAITING_CLAIM_DATA_LOWERS_KEY, txHash);
}

async function removeAwaitingClaimDataLower(txHash: string): Promise<void> {
  await redisClient.srem(AWAITING_CLAIM_DATA_LOWERS_KEY, txHash);
}

async function getAwaitingClaimDataLowers(): Promise<string[]> {
  const awaiting = await redisClient.smembers(AWAITING_CLAIM_DATA_LOWERS_KEY);
  return awaiting || [];
}

async function addUnclaimedLower(txHash: string): Promise<void> {
  await redisClient.sadd(UNCLAIMED_LOWERS_KEY, txHash);
}

async function removeUnclaimedLower(txHash: string): Promise<void> {
  await redisClient.srem(UNCLAIMED_LOWERS_KEY, txHash);
}

async function getUnclaimedLowers(): Promise<string[]> {
  const unclaimed = await redisClient.smembers(UNCLAIMED_LOWERS_KEY);
  return unclaimed || [];
}

async function setSummaries(summaries: any[]): Promise<void> {
  await redisClient.del(SUMMARIES_KEY);
  await redisClient.rpush(
    SUMMARIES_KEY,
    summaries.map(s => dataToJsonString(s))
  );
}

async function getSummaries(): Promise<any[]> {
  const summaries = await redisClient.lrange(SUMMARIES_KEY, 0, -1);
  return summaries ? summaries.map(s => JSON.parse(s)) : [];
}

async function setLowerData(txHash: string, lowerData: any): Promise<void> {
  await redisClient.set(LOWER_DATA_KEY + txHash, dataToJsonString(lowerData));
}

async function deleteLowerData(txHash: string): Promise<void> {
  await redisClient.del(LOWER_DATA_KEY + txHash);
}

async function getLowerData(txHash: string): Promise<any | undefined> {
  const lowerData = await redisClient.get(LOWER_DATA_KEY + txHash);
  return lowerData ? JSON.parse(lowerData) : undefined;
}

async function setLastLowerBlockIdFromAvn(blockId: string): Promise<void> {
  await redisClient.set(LAST_LOWER_BLOCK_ID_FROM_AVN, blockId);
}

async function getLastLowerBlockIdFromAvn(): Promise<string> {
  const blockId = await redisClient.get(LAST_LOWER_BLOCK_ID_FROM_AVN);
  return blockId === null ? '' : blockId;
}

async function setLowerById(lowerId: string, lowerData: any): Promise<void> {
  const senderKey = LOWER_SENDER_PREFIX + lowerData?.from;
  const recipientKey = LOWER_RECIPIENT_PREFIX + lowerData?.to?.toLowerCase();
  await redisClient
    .multi()
    .set(LOWER_ID_PREFIX + lowerId, dataToJsonString(lowerData))
    .sadd(senderKey, lowerId)
    .sadd(recipientKey, lowerId)
    .exec();
}

async function getLowerById(lowerId: string): Promise<any | undefined> {
  const lowerData = await redisClient.get(LOWER_ID_PREFIX + lowerId);
  return lowerData ? JSON.parse(lowerData) : undefined;
}

async function deleteLowerById(lowerId: string): Promise<void> {
  const lowerData = await getLowerById(lowerId);
  if (!lowerData) return;

  const senderKey = LOWER_SENDER_PREFIX + lowerData?.from;
  const recipientKey = LOWER_RECIPIENT_PREFIX + lowerData?.to?.toLowerCase();
  log.trace(`Deleting senderKey: ${senderKey} and recipientKey: ${recipientKey}`);

  await redisClient
    .multi()
    .del(LOWER_ID_PREFIX + lowerId)
    .srem(senderKey, lowerId)
    .srem(recipientKey, lowerId)
    .exec();
}

async function getLowerIdsByAddress(address: string): Promise<string[]> {
  const senderKey = LOWER_SENDER_PREFIX + address;
  const recipientKey = LOWER_RECIPIENT_PREFIX + address;
  let lowerIds = await redisClient.smembers(senderKey);
  if (!lowerIds || lowerIds.length === 0) {
    lowerIds = await redisClient.smembers(recipientKey);
  }
  return lowerIds ? lowerIds : [];
}

async function getLastClaimedEthereumLowerBlock(): Promise<number> {
  const blockNumber = await redisClient.get(LAST_CLAIMED_ETH_LOWER_BLOCK_PREFIX);
  return blockNumber ? parseInt(blockNumber) : 0;
}

async function setLastClaimedEthereumLowerBlock(blockNumber: number): Promise<void> {
  await redisClient.set(LAST_CLAIMED_ETH_LOWER_BLOCK_PREFIX, blockNumber);
}

async function setAutolowerNextT1Block(blockNumber: number): Promise<void> {
  await redisClient.set(NEXT_T1_BLOCK_FOR_AUTOLOWER_KEY, blockNumber);
}

async function getAutolowerNextT1Block(): Promise<number> {
  const blockNumber = await redisClient.get(NEXT_T1_BLOCK_FOR_AUTOLOWER_KEY);
  return blockNumber ? parseInt(blockNumber) : 0;
}

async function setLatestAutolowerId(lowerId: number): Promise<void> {
  await redisClient.set(LATEST_LOWER_ID_FOR_AUTOLOWWER_KEY, lowerId.toString());
}

async function getLatestAutolowerId(): Promise<number> {
  const lowerId = await redisClient.get(LATEST_LOWER_ID_FOR_AUTOLOWER_KEY);
  return lowerId ? parseInt(lowerId) : -1;
}

async function addAutolower(lowerId: number): Promise<void> {
  const result = await redisClient.sadd(AUTOLOWERS_KEY, lowerId.toString());
  const newEntry = result === 1;
  if (newEntry) {
    await redisClient.setex(AUTOLOWER_RETRY_LIFETIME_NAMESPACE + lowerId, AUTOLOWER_RETRY_LIFETIME_SECONDS, 'true');
  }
}

async function removeAutolower(lowerId: number): Promise<void> {
  await redisClient.srem(AUTOLOWERS_KEY, lowerId.toString());
  await redisClient.del(AUTOLOWER_RETRY_LIFETIME_NAMESPACE + lowerId);
}

async function getAutolowers(): Promise<number[]> {
  const lowerIds = await redisClient.smembers(AUTOLOWERS_KEY);
  const liveLowerIds: number[] = [];
  for (const lowerId of lowerIds || []) {
    const exists = await redisClient.exists(AUTOLOWER_RETRY_LIFETIME_NAMESPACE + lowerId);
    const retry = exists === 1;
    if (retry) {
      liveLowerIds.push(parseInt(lowerId));
    } else {
      await removeAutolower(parseInt(lowerId));
    }
  }
  return liveLowerIds;
}

async function acquireAutolowerLock(bridgeAddress: string): Promise<boolean> {
  const result = await redisClient.set(AUTOLOWER_LOCK_KEY, bridgeAddress, 'NX', 'EX', AUTOLOWER_MAX_LOCK_IN_SECONDS);
  return result === 'OK';
}

async function releaseAutolowerLock(bridgeAddress: string): Promise<void> {
  const script = `if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end`;
  await redisClient.eval(script, 1, AUTOLOWER_LOCK_KEY, bridgeAddress);
}

async function refreshAutolowerLock(bridgeAddress: string): Promise<void> {
  const script = `if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("expire", KEYS[1], ARGV[2])
    else
      return 0
    end`;
  await redisClient.eval(script, 1, AUTOLOWER_LOCK_KEY, bridgeAddress, AUTOLOWER_MAX_LOCK_IN_SECONDS.toString());
}

async function setSentTxDetails(txHash: string, details: any): Promise<void> {
  await redisClient.set(WEBHOOKS_SENT_TX_KEY + txHash, dataToJsonString(details));
}

async function getSentTxDetails(txHash: string): Promise<any> {
  const details = await redisClient.get(WEBHOOKS_SENT_TX_KEY + txHash);
  return details ? JSON.parse(details) : {};
}

async function deleteSentTxDetails(txHash: string): Promise<void> {
  await redisClient.del(WEBHOOKS_SENT_TX_KEY + txHash);
}

export {
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
  updateTransactionStatusToPending,
  getLastLowerBlockIdFromAvn,
  setLastLowerBlockIdFromAvn,
  getLowerById,
  setLowerById,
  deleteLowerById,
  getLowerIdsByAddress,
  getLastClaimedEthereumLowerBlock,
  setLastClaimedEthereumLowerBlock,
  setAutolowerNextT1Block,
  getAutolowerNextT1Block,
  setLatestAutolowerId,
  getLatestAutolowerId,
  addAutolower,
  removeAutolower,
  getAutolowers,
  acquireAutolowerLock,
  releaseAutolowerLock,
  refreshAutolowerLock,
  setSentTxDetails,
  getSentTxDetails,
  deleteSentTxDetails
};
