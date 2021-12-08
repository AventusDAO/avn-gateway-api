'use strict'
const { ApiPromise, WsProvider, Keyring } = require('@polkadot/api')
const { isHex, u8aToHex, u8aConcat } = require('@polkadot/util')
const { signatureVerify } = require('@polkadot/util-crypto')
const config = require('multiconfig').load()
const log4js = require('log4js')
const log = log4js.getLogger()
const avn_types = require('./avnTypes')
const redis = require('./redis')

const AVN_URL = config.avnUrl

let api

async function query(palletName, storageName, params) {
  let result

  if (params[0] === 'entries') {
    result = await api.query[palletName][storageName].entries()
  } else {
    result = await api.query[palletName][storageName](...params)
    result = result.toJSON()
  }

  log.trace(`Encoded query response: ${result}`)
  return JSON.stringify(result)
}

async function proxy(requestId, palletName, method, params) {
  log.trace(`Creating inner call from extrinsic api.tx.${palletName}.proxy`)
  let innerCall = await api.tx[palletName][method](...params.proxyParams)
  const txn = await api.tx.avnProxy.proxy(innerCall, params.paymentInfo)
  return await signAndSend(requestId, params.relayerAddress, txn)
}

async function poll(requestId) {
  if (!requestId) {
    log.error(`Unknown request: ${requestId}`)
    return { error: 'Bad request' }
  }

  try {
    if (!isTransactionHash(requestId)) {
      requestId = await redis.getTransactionHashByRequestId(requestId)
    }

    let tx = await redis.getAvnTransaction(requestId)

    if (!tx) {
      log.error(`No transaction found for requestId: ${requestId}`)
      return { error: 'Transaction not found' }
    }

    return { status: tx.status }
  } catch (error) {
    log.error(`Error getting transaction status for requestId ${requestId}: ${error}`)
    throw new Error(`Unable to get transaction status for requestId: ${requestId}`)
  }
}

async function getNonce(senderAddress) {
  let nonce = await redis.getNextNonce(senderAddress)
  if (!nonce) {
    nonce = (await api.query.system.account(senderAddress)).nonce
    await redis.setNonce(senderAddress, nonce)
  } else {
    redis.refreshNonce(senderAddress)
  }
  return nonce
}

async function signAndSend(requestId, relayerAddress, txn) {
  let result, nonce, relayerAccount

  try {
    log.trace(`Getting relayer account for address: ${relayerAddress}`)
    relayerAccount = await getRelayerAccount(relayerAddress)
  } catch (err) {
    log.error(`Error getting relayer account for ${relayerAddress}: ${err}`)
    throw err
  }

  try {
    log.trace(`Encoded Transaction: ${txn}`)
    nonce = await getNonce(relayerAccount.address)
    let signedTx = await txn.signAsync(relayerAccount, { nonce })
    let receipt = await signedTx.send()
    result = { transactionHash: receipt.toString() }
  } catch (err) {
    log.error(`Failed sending transaction: ${err}`)
    await redis.resetNonce(relayerAccount.address)

    // If we failed to get a true transaction hash, use the requestId as key
    if (!result || !result.transactionHash) {
      result.transactionHash = requestId
    }
    await redis.addFailedAvnTransaction(
      requestId,
      result.transactionHash,
      relayerAccount.address.toString(),
      nonce.toString()
    )

    throw err
  }

  await redis.addPendingAvnTransaction(
    requestId,
    result.transactionHash,
    relayerAccount.address.toString(),
    nonce.toString()
  )

  return result
}

async function getRelayerAccount(relayerAddress) {
  // TODO: Replace me with a call to Vault or some other secret management tool AND remove `senderSuri` from config
  const relayerSuri = config.senderSuri

  return createAccount(relayerSuri)
}

async function connectToAvN() {
  log.info(`Creating a connection to the AVN on: ${AVN_URL}`)

  let provider = new WsProvider(AVN_URL)
  api = await ApiPromise.create({
    provider,
    types: avn_types.description,
    typesSpec: avn_types.nodeTypes
  })

  const [chain, nodeName, nodeVersion] = await Promise.all([
    api.rpc.system.chain(),
    api.rpc.system.name(),
    api.rpc.system.version()
  ])

  log.info(`You are connected to chain ${chain} (${AVN_URL}) using ${nodeName} v${nodeVersion}\n`)
}

function createAccount(suri) {
  const keyring = new Keyring({ type: 'sr25519' })
  return keyring.addFromUri(suri)
}

function isTransactionHash(requestId) {
  return isHex(requestId) && requestId.split('').length == 66
}

module.exports = {
  connectToAvN,
  query,
  proxy,
  poll
}
