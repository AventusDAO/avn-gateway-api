const redis = require('redis')
const config = require('multiconfig').load()
const log4js = require('log4js')
const log = log4js.getLogger()

const connectionConfig = {
  rootNodes: [{
    url: config.redis.redisUrl
  }]
}

const transactionObject = {
  senderAddress: 'senderAddress',
  senderNonce: 'senderNonce',
  status: 'status',
  blockNumber: 'blockNumber'
}

const transactionStates = {
  Pending: 'Pending',
  Processed: 'Processed',
  Rejected: 'Rejected',
  SendingFailed: 'SendingFailed'
}

// This is required to avoid CROSSSLOT errors: https://aws.amazon.com/premiumsupport/knowledge-center/elasticache-crossslot-keys-error-redis/
const SLOT_PREFIX = '{gateway}:'

const ALL_PENDING_TXS_KEY = `${SLOT_PREFIX}PendingTransactionsList`
const CURRENT_PENDING_TXS_BEING_CHECKED_KEY = `${SLOT_PREFIX}cTx`
const NEXT_PENDING_TXS_TO_CHECK_KEY = `${SLOT_PREFIX}nTx`

const MAX_PENDING_TX_TO_CHECK = 10
const CHECK_WINDOW = 10 * 1000 // 10 seconds

const NONCE_NAMESPACE = 'Nonce.'
const NONCE_EXPIRY_IN_SECONDS = 5

let redisClient

async function connect() {
  log.info(`Attempting to connect to Redis database on ${connectionConfig.rootNodes[0].url}`)

  redisClient = redis.createCluster(connectionConfig)

  redisClient.on('connect', () => log.info('Connected to Redis database'))
  redisClient.on('reconnecting', () => log.warn('Reconnecting to Redis database'))
  redisClient.on('error', err => log.error('Redis connection error ', err))
  redisClient.on('end', () => log.warn('Closing Redis connection'))

  await redisClient.connect()
}

function getKey(key) {
  return `${SLOT_PREFIX}${key}`
}

async function addPendingAvnTransaction(_transactionHash, senderAddress, senderNonce) {
  const transactionHash = getKey(_transactionHash)

  if (await redisClient.exists(transactionHash)) {
    throw new Error(`Transaction hash (${transactionHash}) exists already, cannot add duplicate value.`)
  }

  log.trace(`Adding pending transaction hash for ${transactionHash} for ${senderAddress} - ${senderNonce}`)

  const [x,y] = await redisClient
    .multi()
    .hSet(transactionHash, buildTransactionJson(senderAddress, senderNonce))
    .zAdd(ALL_PENDING_TXS_KEY, { value: _transactionHash, score:'+inf' })
    .exec()

  log.trace(`Adding completed for hash ${_transactionHash}: ${x}, ${y}`)
  const newTx = getAvnTransaction(_transactionHash)
  log.trace(`Tx details: ${JSON.stringify(newTx)}`)
}

// Returns an empty object (not undefined or null) if key is not found
async function getAvnTransaction(_transactionHash) {
  const transactionHash = getKey(_transactionHash)

  if (await redisClient.exists(transactionHash)) {
    console.log(`${transactionHash} exists`)
  } else {
    console.log(`${transactionHash} DOES NOT exist`)
  }

  log.trace(`Getting tx details for: ${_transactionHash} using hash: ${transactionHash}`)

  return await redisClient.hGetAll(transactionHash)
}

async function resolvePendingAvnTransactions(transactions) {
  log.trace(`Updating ${transactions.length} transactions`)
  for (const tx of transactions) {
    const transactionHash = getKey(tx.transactionHash)

    if (![transactionStates.Processed, transactionStates.Rejected].includes(tx.state)) {
      log.warn(
        `Attempting to update transaction ${transactionHash} with an invalid status of ${tx.state}, ignoring request`
      )
      continue
    }

    const newValue = {}
    newValue[transactionObject.status] = tx.state
    newValue[transactionObject.blockNumber] = tx.blockNumber

    log.trace(`New value for ${tx.transactionHash}: ${JSON.stringify(newValue)}`)

    await redisClient
      .multi()
      .hSet(transactionHash, newValue)
      .zRem(ALL_PENDING_TXS_KEY, tx.transactionHash)
      .exec()
  }
  log.trace(`Updating completed`)
}

async function getNextTransactionsToCheck() {
  const redisTime = Date.now()
  const expiry = redisTime + CHECK_WINDOW

  const [_numExpired, _numAwaitingCheck, txToCheckNext] = await redisClient
    .multi()
    .zRemRangeByScore(CURRENT_PENDING_TXS_BEING_CHECKED_KEY, 0, redisTime) // Remove the ones we have processed
    .zDiffStore(NEXT_PENDING_TXS_TO_CHECK_KEY, [ALL_PENDING_TXS_KEY, CURRENT_PENDING_TXS_BEING_CHECKED_KEY]) // Store all remaining hashes
    .zRange(NEXT_PENDING_TXS_TO_CHECK_KEY, 0, MAX_PENDING_TX_TO_CHECK - 1) // shrink that list based on MAX_PENDING_TX_TO_CHECK
    .exec()

  if (txToCheckNext.length > 0) {
    await redisClient.zAdd(CURRENT_PENDING_TXS_BEING_CHECKED_KEY, txToCheckNext.map(txHash => ({value: txHash, score: expiry})))
  }

  log.warn(`\n\ngetNextTransactionsToCheck result: ${txToCheckNext}\n\n`)
  return txToCheckNext
}

function buildTransactionJson(senderAddress, senderNonce) {
  const result = {}
  result[transactionObject.senderAddress] = senderAddress
  result[transactionObject.senderNonce] = senderNonce || ''
  result[transactionObject.status] = transactionStates.Pending

  log.trace(`buildTransactionJson: ${JSON.stringify(result)}`)
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
  await redisClient.setEx(NONCE_NAMESPACE + senderAddress, NONCE_EXPIRY_IN_SECONDS, nonce.toString())
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
