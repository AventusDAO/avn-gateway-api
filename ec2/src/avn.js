'use strict'
const { ApiPromise, WsProvider, Keyring } = require('@polkadot/api')
const config = require('multiconfig').load()
const log4js = require('log4js')
const fs = require('fs')
const log = log4js.getLogger()
const avn_types = require('./avnTypes')
const { request } = require('http')

const URL = config.avnUrl
const SENDER = config.senderSuri
let api, sender

async function query(palletName, storageName, params) {
  let result
  try {
    const result = await api.query[palletName][storageName](...params)
    log.trace(`Encoded query response: ${result}`)
    return result
  } catch (err) {
    log.error(`Error processing query: ${err}`)
    result = { error: err.toString() }
  }
  return result
}

async function tx(palletName, method, params) {
  log.trace(`Sending extrinsic api.tx.${palletName}.${method}`)
  const txn = await api.tx[palletName][method](...params)

  return await signAndSend(txn)
}

async function proxy(palletName, method, params) {
  let result
  try {
    log.trace(`Creating inner call from extrinsic api.tx.${palletName}.proxy`)
    let innerCall = await api.tx[palletName][method](...params)
    const txn = await api.tx[palletName]['proxy'](innerCall)

    return await signAndSend(txn)
  } catch (err) {
    log.error(`Failed sending proxy transaction: ${err}`)
    result = { error: err.toString() }
  }
  return result
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

async function signAndSend(txn) {
  try {
    let result

    log.trace(`Encoded Transaction: ${txn}`)
    let signedTransaction = await txn.signAsync(sender, { era: 64 }) // default era is 128. using 50 or 60 rounds it to 64 in practice

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
    result = { error: err.toString() }
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

  log.info(`You are connected to chain ${chain} (${URL}) using ${nodeName} v${nodeVersion}\n`)

  return avnConnection
}

async function createAccount(suri) {
  const keyring = new Keyring({ type: 'sr25519' })
  return await keyring.addFromUri(suri)
}

async function instantiateEC2() {
  log.info(`Creating a connection to the AVN on: ${URL}`)
  api = await connectToAvN(URL)

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
