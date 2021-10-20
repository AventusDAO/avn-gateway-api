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
    //TODO: Add more validate such as checking if we have sent that tx already (check by reading from DB)
    log.error(`Unknown request: ${requestId}`)
    return { error: 'Bad request' }
  }

  // TODO: Replace me with a database call
  const axios = require('axios')
  const BLOCK_EXPLORER_URL = `https://avn.sandbox.aventus.io:3000/transactions/${requestId}`
  let result

  try {
    let state
    let res = await axios.get(BLOCK_EXPLORER_URL)
    log.trace(`Indexer found ${JSON.stringify(res.data.data.hits.total.value)} record(s)`)
    const response = res.data.data.hits.hits

    if (response.length > 0) {
      state = response[0]._source.isFailed === true ? 'Rejected' : 'Processed'
    } else {
      state = 'Pending'
    }

    result = { state: state }
  } catch (error) {
    log.error(`Error getting transaction state for requestId ${requestId}: ${error}`)
    throw new Error(`Unable to get transaction state for requestId: ${requestId}`)
  }

  return result
}

async function signAndSend(txn) {
  let result

  try {
    log.trace(`Encoded Transaction: ${txn}`)
    let signedTransaction = await txn.signAsync(sender, { era: 64 }) // default era is 128. using 50 or 60 rounds it to 64 in practice

    log.trace('Encoded signed: %j', signedTransaction)

    let receipt = await signedTransaction.send()
    let requestId = receipt.toString()

    result = { requestId }
  } catch (err) {
    log.error(`Failed sending transaction: ${err}`)
    throw err
  }

  // TODO: Add nonce to addPendingAvnTransaction if available
  redis.addPendingAvnTransaction(result.requestId, sender.address.toString())

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
