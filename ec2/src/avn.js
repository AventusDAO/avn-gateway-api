'use strict'
const { ApiPromise, WsProvider, Keyring } = require('@polkadot/api')
const config = require('multiconfig').load()
const log4js = require('log4js')
const fs = require('fs')
const log = log4js.getLogger()
const avn_types = require('./avnTypes')
const { createClient } = require('redis')

const AVN_URL = config.avnUrl
const REDIS_URL = config.redisUrl
const SENDER = config.senderSuri
const SMARTNONCE_EXPIRY_IN_SECONDS = 5
let api, redis, sender

async function query(palletName, storageName, params) {
  const result = await api.query[palletName][storageName](...params)
  log.trace(`Encoded query response: ${result}`)
  return result
}

async function tx(palletName, method, params) {
  log.trace(`Sending extrinsic api.tx.${palletName}.${method}`)
  const txn = await api.tx[palletName][method](...params)

  return await signAndSend(txn)
}

async function proxy(palletName, method, params) {
  log.trace(`Creating inner call from extrinsic api.tx.${palletName}.proxy`)
  let innerCall = await api.tx[palletName][method](...params)
  const txn = await api.tx[palletName]['proxy'](innerCall)

  return await signAndSend(txn)
}

async function poll(requestId) {
  let fd, result

  let stateFilename = `state_${requestId}`
  try {
    fd = fs.openSync(stateFilename, 'r')
  } catch (error) {
    log.error(`Unknown request: ${requestId}`)
    result = { error: 'Bad request' }
  }

  try {
    let state = fs.readFileSync(fd, 'utf8')

    fs.closeSync(fd)
    result = { state: state }
  } catch (error) {
    log.error(`Error reading state file: ${stateFilename}`)
    result = { error: `Unable to access request's state` }
  }

  return result
}

async function smartNonce(address) {
  let nonce = await redis.incr(address)

  if (nonce === 1) {
    nonce = (await api.query.system.account(address)).nonce
    await redis.setex(address, SMARTNONCE_EXPIRY_IN_SECONDS, nonce)
  } else {
    await redis.expire(address, SMARTNONCE_EXPIRY_IN_SECONDS)
  }

  return nonce
}

async function signAndSend(txn) {
  let result

  try {
    log.trace(`Encoded Transaction: ${txn}`)
    let signedTransaction = await txn.signAsync(sender, {nonce: await smartNonce(sender.address), era: 64}) // default era is 128. using 50 or 60 rounds it to 64 in practice

    log.trace('Encoded signed: %j', signedTransaction)

    let receipt = await signedTransaction.send()
    let requestId = receipt.toString()
    result = { requestId: requestId }

    // TODO: replace me with real code
    let stateFilename = `state_${requestId}`
    let fd = fs.openSync(stateFilename, 'w')
    fs.writeSync(fd, 'Pending')
    fs.closeSync(fd)
  } catch (err) {
    log.error(`Failed sending transaction: ${err}`)
    throw err
  }

  return result
}

async function connectToAvN(url) {
  let provider = new WsProvider(url)
  const avnConnection = await ApiPromise.create({
    provider,
    types: avn_types.description,
    typesSpec: avn_types.nodeTypes
  })

  const [chain, nodeName, nodeVersion] = await Promise.all([
    avnConnection.rpc.system.chain(),
    avnConnection.rpc.system.name(),
    avnConnection.rpc.system.version()
  ])

  log.info(`You are connected to chain ${chain} (${AVN_URL}) using ${nodeName} v${nodeVersion}\n`)

  return avnConnection
}

async function connectToRedis(url) {
  const client = createClient({url: url})
  client.on('error', (err) => log.info('Redis Client Error', err));
  await client.connect()
  log.info(`You are connected to MemoryDB Redis (${url})`)
  return client
}

async function createAccount(suri) {
  const keyring = new Keyring({ type: 'sr25519' })
  return await keyring.addFromUri(suri)
}

async function instantiateEC2() {
  log.info(`Creating a connection to the AVN on: ${AVN_URL}`)
  api = await connectToAvN(AVN_URL)

  log.info(`Creating a connection to MemoryDB Redis on: ${REDIS_URL}`)
  redis = await connectToRedis(REDIS_URL)

  sender = await createAccount(SENDER)
  log.info(`Using sender with address: ${sender.address.toString()}`)
}

module.exports = {
  instantiateEC2,
  query,
  tx,
  proxy,
  poll
}
