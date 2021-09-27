'use strict'
const { ApiPromise, WsProvider } = require('@polkadot/api')
const config = require('multiconfig').load()
const log4js = require('log4js')
const log = log4js.getLogger()
const avn_types = require('./avnTypes')


const URL = config.avnUrl
let api

async function query(palletName, storageName, params) {
  const result = await api.query[palletName][storageName](...params)
  log.trace(`Encoded query response: ${result}`)
  return result
}

// for now, no proxy. Just trying to reach and send something
async function tx(palletName, storageName, params) {
  const txn = await api.tx[palletName][storageName](...params)
  log.trace(`Encoded Transaction: ${txn}`)
  let signedTransaction = await txn.signAsync(sender.keys, {era: 64 });  // default era is 128. using 50 or 60 rounds it to 64 in practice
  let result
  try {
    result = await signedTransaction.send()
  } catch (error) {
    log.trace(`Failed sending transaction: ${error}`)
    result = "error"
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

async function instantiateEC2() {
  log.info(`Creating a connection to the AVN on: ${URL}`)
  api = await connectToAvN(URL)
}

module.exports = {
  instantiateEC2,
  query
}
