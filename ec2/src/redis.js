const Redis = require('ioredis')
const config = require('multiconfig').load()
const log4js = require('log4js')
const log = log4js.getLogger()

const transactionObject = {
  senderAddress: 'senderAddress',
  senderNonce: 'senderNonce',
  status: 'status',
  blockNumber: 'blockNumber'
}

const transactionStatus = {
  Pending: 'Pending',
  Processed: 'Processed',
  Rejected: 'Rejected',
  SendingFailed: 'SendingFailed'
}

// This is required to avoid CROSSSLOT errors: https://aws.amazon.com/premiumsupport/knowledge-center/elasticache-crossslot-keys-error-redis/
const SLOT_PREFIX = '{gateway}:'
const NONCE_NAMESPACE = 'Nonce.'

const PENDING_TX_KEY = {
  ALL: `${SLOT_PREFIX}aTx`,
  CHECKING: `${SLOT_PREFIX}cTx`,
  NEXT: `${SLOT_PREFIX}nTx`
}

const MAX_PENDING_TX_TO_CHECK = 10
const PENDING_TX_CHECKING_WINDOW_IN_SECONDS = 10
const NONCE_EXPIRY_IN_SECONDS = 5

let redisClient

async function connect() {
  log.info(`Attempting to connect to Redis database on ${config.redis.redisUrl}`)
  redisClient = new Redis.Cluster([
    {
      port: 6379,
      host: "gateway-api-no-enc.yv2zxv.clustercfg.memorydb.eu-west-1.amazonaws.com",
    }
  ]);


    new Redis(config.redis.redisUrl)
  const hello = await redisClient.hello()
  log.info('Connected to Redis database:', hello)

  redisClient.defineCommand('nextzsubset', {
    numberOfKeys:2,
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
  })
}

function getKey(key) {
  return `${SLOT_PREFIX}${key}`
}

async function addPendingAvnTransaction(_transactionHash, senderAddress, senderNonce) {
  const transactionHash = getKey(_transactionHash)

  if (await redisClient.exists(transactionHash)) {
    throw new Error(`Transaction hash (${transactionHash}) exists already, cannot add duplicate value.`)
  }

  await redisClient
    .multi()
    .hset(transactionHash, buildTransactionJson(senderAddress, senderNonce))
    .zadd(PENDING_TX_KEY.ALL, '+inf', _transactionHash)
    .exec()
}

// Returns null if key is not found
async function getAvnTransaction(_transactionHash) {
  const transactionHash = getKey(_transactionHash)
  return await redisClient.hgetall(transactionHash)
}

async function resolvePendingAvnTransactions(transactions) {
  if (!transactions) {
    log.trace(`No transactions to update`)
    return
  }

  log.trace(`Updating ${transactions.length} transactions`)
  for (const tx of transactions) {
    const transactionHash = getKey(tx.transactionHash)

    if (![transactionStatus.Processed, transactionStatus.Rejected].includes(tx.status)) {
      log.warn(
        `Attempting to update transaction ${transactionHash} with an invalid status of ${tx.status}, ignoring request`
      )
      continue
    }

    const newValue = {}
    newValue[transactionObject.status] = tx.status
    newValue[transactionObject.blockNumber] = tx.blockNumber

    await redisClient
      .multi()
      .hset(transactionHash, newValue)
      .zrem(PENDING_TX_KEY.ALL, tx.transactionHash)
      .exec()
  }
}

async function getNextTransactionsToCheck() {
  const timeNow = Date.now()
  const expiry = timeNow + PENDING_TX_CHECKING_WINDOW_IN_SECONDS * 1000

  const [_numExpired, _numAwaitingCheck, txToCheckNext] = await redisClient
  .multi()
  .zremrangebyscore(PENDING_TX_KEY.CHECKING, '-inf', timeNow) // Expire any transactions that have been being checked for too long
  .zdiffstore(PENDING_TX_KEY.NEXT, 2, PENDING_TX_KEY.ALL, PENDING_TX_KEY.CHECKING) // Get transactions that are not currently being checked
  .nextzsubset(PENDING_TX_KEY.NEXT, PENDING_TX_KEY.CHECKING, MAX_PENDING_TX_TO_CHECK, expiry) // Update the expiry of the next subset to check and return it
  .exec()

  log.trace(`\n\ngetNextTransactionsToCheck result: ${txToCheckNext[1]}\n`)
  return txToCheckNext[1]
}

function buildTransactionJson(senderAddress, senderNonce) {
  const result = {}
  result[transactionObject.senderAddress] = senderAddress
  result[transactionObject.senderNonce] = senderNonce || ''
  result[transactionObject.status] = transactionStatus.Pending
  return result
}

async function getNextNonce(senderAddress) {
  const nextNonce = await redisClient.incr(NONCE_NAMESPACE + senderAddress)
  // If the nonce does not exist (or has expired) redis will return an incremented 0 value, i.e.: 1
  return nextNonce === 1 ? undefined : nextNonce
}

async function resetNonce(senderAddress) {
  await redisClient.decr(NONCE_NAMESPACE + senderAddress)
}

async function setNonce(senderAddress, nonce) {
  await redisClient.setex(NONCE_NAMESPACE + senderAddress, NONCE_EXPIRY_IN_SECONDS, nonce.toString())
}

async function refreshNonce(senderAddress) {
  await redisClient.expire(NONCE_NAMESPACE + senderAddress, NONCE_EXPIRY_IN_SECONDS)
}

module.exports = {
  connect,
  addPendingAvnTransaction,
  getAvnTransaction,
  getNextNonce,
  resetNonce,
  setNonce,
  refreshNonce,
  getNextTransactionsToCheck,
  resolvePendingAvnTransactions
}
