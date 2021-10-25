'use strict'
const { ApiPromise, WsProvider, Keyring } = require('@polkadot/api')
const config = require('multiconfig').load()
const log4js = require('log4js')
const log = log4js.getLogger()
const avn_types = require('./avnTypes')
const redis = require('./redis')

const AVN_URL = config.avnUrl
const SENDER = config.senderSuri
let api, sender

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
  if (!requestId) {
    log.error(`Unknown request: ${requestId}`)
    return { error: 'Bad request' }
  }

  try {
    log.warn(`getting transaction status for ${requestId}`)
    let tx = await redis.getAvnTransaction(requestId)

    if (!tx) {
      log.error(`No transaction found for requestId: ${requestId}`)
      return { error: 'Transaction not found' }
    }

    log.warn(`poll response: state: ${tx.status}`)
    return { state: tx.status }
  } catch (error) {
    log.error(`Error getting transaction state for requestId ${requestId}: ${error}`)
    throw new Error(`Unable to get transaction state for requestId: ${requestId}`)
  }
}

async function getNonce(senderAddress) {
  let nonce = await redis.getNextNonce(senderAddress)
  if (!nonce) {
    nonce = (await api.query.system.account(senderAddress)).nonce
    await redis.setNonce(senderAddress, nonce)
  } else {
    await redis.refreshNonce(senderAddress)
  }
  return nonce
}

async function signAndSend(txn) {
  let result, nonce

  try {
    log.trace(`Encoded Transaction: ${txn}`)
    nonce = await getNonce(sender.address)
    log.warn(`Signing and sending: ${nonce}`)
    let receipt = await txn.signAndSend(sender, { nonce })
    log.warn(`Tx sent, receipt: ${receipt}`)
    let requestId = receipt.toString()
    result = { requestId }
  } catch (err) {
    log.error(`Failed sending transaction: ${err}`)
    await redis.resetNonce(sender.address)
    throw err
  }

  log.warn(`Adding to Redis`)
  await redis.addPendingAvnTransaction(result.requestId, sender.address.toString(), nonce.toString())

  return result
}

async function connectToAvN() {
  log.info(`Creating a connection to the AVN on: ${AVN_URL}`)

  let provider = new WsProvider(AVN_URL)
  api = await ApiPromise.create({
    provider,
    types: avn_types.description,
    typesSpec: avn_types.nodeTypes
  })

  sender = createAccount(SENDER)

  const [chain, nodeName, nodeVersion] = await Promise.all([
    api.rpc.system.chain(),
    api.rpc.system.name(),
    api.rpc.system.version()
  ])

  log.info(`You are connected to chain ${chain} (${AVN_URL}) using ${nodeName} v${nodeVersion}\n`)
  log.info(`Relayer address: ${sender.address.toString()}`)
}

function createAccount(suri) {
  const keyring = new Keyring({ type: 'sr25519' })
  return keyring.addFromUri(suri)
}

module.exports = {
  connectToAvN,
  query,
  tx,
  proxy,
  poll
}
