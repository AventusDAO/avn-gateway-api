'use strict'
const { ApiPromise, WsProvider, Keyring } = require('@polkadot/api')
const config = require('multiconfig').load()
const log4js = require('log4js')
const log = log4js.getLogger()
const avn_types = require('./avnTypes')

const URL = config.avnUrl
const SENDER = config.senderSuri
let api, sender

async function query(palletName, storageName, params) {
  const result = await api.query[palletName][storageName](...params)
  log.trace(`Encoded query response: ${result}`)
  return result
}

// for now, no proxy. Just trying to reach and send something
async function tx(palletName, method, params) {
  log.trace(`Sending extrinsic api.tx.${palletName}.${method}`)
  const txn = await api.tx[palletName][method](...params)
  log.trace(`Encoded Transaction: ${txn}`)
  let signedTransaction = await txn.signAsync(sender, { era: 64 }) // default era is 128. using 50 or 60 rounds it to 64 in practice
  log.trace('Encoded signed: %j', signedTransaction)
  let result
  try {
    result = await signedTransaction.send()
  } catch (error) {
    log.trace(`Failed sending transaction: ${error}`)
    result = { chainError: error }
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
  console.log('Using sender with address: %o', sender.address.toString())
}

module.exports = {
  instantiateEC2,
  query,
  tx
}
