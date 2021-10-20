const redis = require('redis')
const config = require('multiconfig').load()
const log4js = require('log4js')
const log = log4js.getLogger()

const connectionConfig = {
  url: config.redis.redisUrl
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

const PENDING_TRANSACTIONS_KEY = 'PendingTransactionsList'
const MAX_PENDING_TRANSACTIONS = 50
const NONCE_NAMESPACE = 'Nonce.'
const NONCE_EXPIRY_IN_SECONDS = 5

let redisClient

async function connect() {
  log.info(`Attempting to connect to Redis database on ${connectionConfig.url}`)

  redisClient = redis.createClient(connectionConfig)

  redisClient.on('connect', () => log.info('Connected to Redis database'))
  redisClient.on('reconnecting', () => log.warn('Reconnecting to Redis database'))
  redisClient.on('error', err => log.error('Redis connection error ', err))
  redisClient.on('end', () => log.warn('Closing Redis connection'))

  await redisClient.connect()
}

async function addPendingAvnTransaction(transactionHash, senderAddress, senderNonce) {
  if (await redisClient.exists(transactionHash)) {
    throw new Error(`Transaction hash (${transactionHash}) exists already, cannot add duplicate value.`)
  }

  await redisClient
    .multi()
    .hSet(transactionHash, buildTransactionJson(senderAddress, senderNonce))
    .sAdd(PENDING_TRANSACTIONS_KEY, transactionHash)
    .exec()
}

// Returns an empty object (not undefined or null) if key is not found
async function getAvnTransaction(transactionHash) {
  return await redisClient.hGetAll(transactionHash)
}

async function updateAvnTransactionStatus(transactionHash, status, blockNumber) {
  if (!(await redisClient.exists(transactionHash))) {
    throw new Error(`Transaction hash (${transactionHash}) does not exist in the database, cannot update state.`)
  }

  if (![transactionStates.Processed, transactionStates.Rejected].includes(status)) {
    log.warn(
      `Attempting to update transaction ${transactionHash} with an invalid status of ${status}, ignoring request`
    )
    return
  }

  const transaction = await redisClient.hGetAll(transactionHash)
  transaction[transactionObject.status] = status
  transaction[transactionObject.blockNumber] = blockNumber

  await redisClient
    .multi()
    .hSet(transactionHash, transaction)
    .sRem(PENDING_TRANSACTIONS_KEY, transactionHash)
    .exec()
}

async function resolvePendingAvnTransactions(transactions) {
  for (const tx of transactions) {
    await updateAvnTransactionStatus(tx.transactionHash, tx.state, tx.blockNumber)
  }
}

async function getAllPendingTransactions() {
  return await redisClient.sMembers(PENDING_TRANSACTIONS_KEY)
}

async function getRandomPendingTransactions() {
  log.trace(`Returning random ${MAX_PENDING_TRANSACTIONS} pending transactions`)
  return await redisClient.sRandMemberCount(PENDING_TRANSACTIONS_KEY, MAX_PENDING_TRANSACTIONS)
}

function buildTransactionJson(senderAddress, senderNonce) {
  const result = {}
  result[transactionObject.senderAddress] = senderAddress
  result[transactionObject.senderNonce] = senderNonce || ''
  result[transactionObject.status] = transactionStates.Pending

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
  updateAvnTransactionStatus,
  resetNonce,
  setNonce,
  refreshNonce,
  getRandomPendingTransactions,
  getAllPendingTransactions,
  resolvePendingAvnTransactions
}
