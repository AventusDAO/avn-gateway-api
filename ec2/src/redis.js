const redis = require("redis")
const config = require('multiconfig').load()
const log4js = require('log4js')
const log = log4js.getLogger()

const connectionConfig = {
  host: config.redis.host,
  port: config.redis.port,
  retry_strategy: retryStrategy
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

let redisClient;

function retryStrategy(options) {
  if (options.error && options.error.code === "ECONNREFUSED") {
      // No point retrying if the connection has been refused
      return new Error("The server refused the connection")
  }

  if (options.total_retry_time > 1000 * 60) {
      // End reconnecting after 1 minute of retry
      return new Error("Retry time exhausted")
  }

  if (options.attempt > 10) {
      // End reconnecting after 10 attempts
      return undefined
  }

  // reconnect after
  return Math.min(options.attempt * 100, 3000)
}

async function connect() {
  log.info(`Attempting to connect to Redis database on ${connectionConfig.host}:${connectionConfig.port}`);

  redisClient = redis.createClient()

  redisClient.on('connect'     , () => log.info('Connected to Redis database'));
  redisClient.on('reconnecting', () => log.warn('Reconnecting to Redis database'));
  redisClient.on('error'       , (err) => log.error('Redis connection error ', err));
  redisClient.on('end'         , () => log.warn('Closing Redis connection'));

  await redisClient.connect(connectionConfig)
}

async function addPendingAvnTransaction(transactionHash, senderAddress, senderNonce) {
  if (await redisClient.exists(transactionHash)) {
      throw new Error(`Transaction hash (${transactionHash}) exists already, cannot add duplicate value.`)
  }

  await redisClient
    .multi()
    .hSet(transactionHash, buildTransactionJson(senderAddress, senderNonce))
    .sAdd(PENDING_TRANSACTIONS_KEY, transactionHash)
    .exec();
}

// Returns an empty object (not undefined or null) if key is not found
async function getAvnTransaction(transactionHash) {
  return await redisClient.hGetAll(transactionHash)
}

async function updateAvnTransactionStatus(transactionHash, status, blockNumber) {
  if (!await redisClient.exists(transactionHash)) {
    throw new Error(`Transaction hash (${transactionHash}) does not exist in the database, cannot update state.`)
  }

  const transaction = await redisClient.hGetAll(transactionHash)
  transaction[transactionObject.status] = status
  transaction[transactionObject.blockNumber] = blockNumber

  await redisClient
    .multi()
    .hSet(transactionHash, transaction)
    .sRem(PENDING_TRANSACTIONS_KEY, transactionHash)
    .exec();
}

async function getPendingTransactions() {
  return await redisClient.sMembers(PENDING_TRANSACTIONS_KEY)
}

function buildTransactionJson(senderAddress, senderNonce) {
  const result = {}
  result[transactionObject.senderAddress] = senderAddress
  result[transactionObject.senderNonce] = senderNonce
  result[transactionObject.status] = transactionStates.Pending

  return result
}

module.exports = {
  connect,
  addPendingAvnTransaction,
  getAvnTransaction,
  updateAvnTransactionStatus,
  getPendingTransactions
}
