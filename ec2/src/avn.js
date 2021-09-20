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
  log.trace(`Query response: ${result}`)
  return result
}

async function connectToAvN(url) {
  let provider = new WsProvider(url)
  const api = await ApiPromise.create({
    provider,
    types: avn_types.description,
    typesSpec: avn_types.nodeTypes
  })

  const [chain, nodeName, nodeVersion] = await Promise.all([
    api.rpc.system.chain(),
    api.rpc.system.name(),
    api.rpc.system.version()
  ])

  log.info(`You are connected to chain ${chain} (${URL}) using ${nodeName} v${nodeVersion}\n`)

  return api
}

async function instantiateEC2() {
  log.info(`Creating a connection to the AVN on: ${URL}`)
  api = await connectToAvN(URL)
}

module.exports = {
  instantiateEC2,
  query
}
