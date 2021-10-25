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

const ALL_PENDING_TXS_KEY = 'PendingTransactionsList'
const CURRENT_PENDING_TXS_BEING_CHECKED_KEY = 'cTx'
const NEXT_PENDING_TXS_TO_CHECK_KEY = 'nTx'
const MAX_PENDING_TX_TO_CHECK = 10
const CHECK_WINDOW = 10 * 1000000 // 10 seconds

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

  console.log(`***** Connecting now`)
  await redisClient.connect()

  console.dir(redisClient)

  console.log(`***** Testing connection`)
  const nonce = await getNextNonce('5FbUQ2kJWLoqHuSTSNNqBwKwdQnBVe4HF3TeGyu6UoZaryTh')
  console.log(`***** Nonce: ${nonce}`)
}

async function addPendingAvnTransaction(transactionHash, senderAddress, senderNonce) {
  if (await redisClient.exists(transactionHash)) {
    throw new Error(`Transaction hash (${transactionHash}) exists already, cannot add duplicate value.`)
  }

  await redisClient
    .multi()
    .hSet(transactionHash, buildTransactionJson(senderAddress, senderNonce))
    .zAdd(ALL_PENDING_TXS_KEY, { value: transactionHash, score:'+inf' })
    .exec()
}

// Returns an empty object (not undefined or null) if key is not found
async function getAvnTransaction(transactionHash) {
  return await redisClient.hGetAll(transactionHash)
}

async function resolvePendingAvnTransactions(transactions) {
  log.trace(`Updating ${transactions.length} transactions`)
  for (const tx of transactions) {
    if (![transactionStates.Processed, transactionStates.Rejected].includes(tx.state)) {
      log.warn(
        `Attempting to update transaction ${tx.transactionHash} with an invalid status of ${tx.state}, ignoring request`
      )
      continue
    }

    const newValue = {}
    newValue[transactionObject.status] = tx.state
    newValue[transactionObject.blockNumber] = tx.blockNumber

    await redisClient
      .multi()
      .hSet(tx.transactionHash, newValue)
      .zRem(ALL_PENDING_TXS_KEY, tx.transactionHash)
      .exec()
  }
  log.trace(`Updating completed`)
}

async function getNextTransactionsToCheck() {
  const redisTime = await redisClient.time()
  const redisTimeMicro = new Date(redisTime).getTime() * 1000000 + redisTime.microseconds
  const expiry = redisTimeMicro + (CHECK_WINDOW)

  const [_numExpired, _numAwaitingCheck, txToCheckNext] = await redisClient
    .multi()
    .zRemRangeByScore(CURRENT_PENDING_TXS_BEING_CHECKED_KEY, 0, redisTimeMicro) // Remove the ones we have processed
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

  return result
}

async function getNextNonce(senderAddress) {
  console.log('getNextNonce')
  const nextNonce = await redisClient.incr(NONCE_NAMESPACE + senderAddress)
  // If the nonce does not exist (or has expired) redis will return an incremented 0 value, i.e.: 1
  console.log('returing getNextNonce')
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
