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
const SENDER = config.senderSuri
const FEE_PAYMENT_CONTEXT = 'authorization for proxy payment'

let api, sender

async function query(palletName, storageName, params) {
  const result = await api.query[palletName][storageName](...params)
  log.trace(`Encoded query response: ${result}`)
  return result
}

async function tx(requestId, palletName, method, params) {
  log.trace(`Sending extrinsic api.tx.${palletName}.${method}`)
  const txn = await api.tx[palletName][method](...params)

  return await signAndSend(requestId, txn)
}

async function proxy(requestId, palletName, method, params) {
  let paymentInfo

  try {
    paymentInfo = await verifyPaymentAuthorisation(params.paymentDetails)
  } catch (error) {
    log.error(`Invalid fee authorisation for ${requestId}: ${error}`)
    return { error: 'Invalid fee authorisation' }
  }

  log.trace(`Creating inner call from extrinsic api.tx.${palletName}.proxy`)
  let innerCall = await api.tx[palletName][method](...params.proxyParams)
  const txn = await api.tx.avnProxy.proxy(innerCall, paymentInfo)
  return await signAndSend(requestId, txn)
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

async function verifyPaymentAuthorisation(p) {
  log.trace('Verifying fee payment authorisation')

  const gatewayFee = await getGatewayFee()
  const context = api.createType('Text', FEE_PAYMENT_CONTEXT)
  const encodedProxyProof = api.createType('Proof', p.proxyProof)
  const encodedRelayer = api.createType('AccountId', p.relayer)
  const encodedGatewayFee = api.createType('Balance', gatewayFee)
  const encodedPaymentNonce = api.createType('u64', p.paymentNonce)

  const encodedData = u8aConcat(
    context.toU8a(false),
    encodedProxyProof.toU8a(false),
    encodedRelayer.toU8a(true),
    encodedGatewayFee.toU8a(true),
    encodedPaymentNonce.toU8a(true)
  )

  const hexEncodedData = u8aToHex(encodedData)
  const { isValid } = signatureVerify(hexEncodedData, p.feePaymentSignature, p.signer)

  if (isValid) {
    log.trace('Fee payment authorisation verified')
    return {
      recipient: p.relayer,
      amount: gatewayFee,
      signature: {
        Sr25519: p.feePaymentSignature
      }
    }
  } else {
    throw new Error(`Invalid fee payment signature ${p.feePaymentSignature}`)
  }
}

async function getGatewayFee() {
  // TODO - get from redis
  return '1000000000000000'
}

async function signAndSend(requestId, txn) {
  let result, nonce

  try {
    log.trace(`Encoded Transaction: ${txn}`)
    nonce = await getNonce(sender.address)
    let signedTx = await txn.signAsync(sender, { nonce })
    let receipt = await signedTx.send()
    result = { transactionHash: receipt.toString() }
  } catch (err) {
    log.error(`Failed sending transaction: ${err}`)
    await redis.resetNonce(sender.address)

    // If we failed to get a true transaction hash, use the requestId as key
    if (!result || !result.transactionHash) {
      result.transactionHash = requestId
    }
    await redis.addFailedAvnTransaction(requestId, result.transactionHash, sender.address.toString(), nonce.toString())

    throw err
  }

  await redis.addPendingAvnTransaction(requestId, result.transactionHash, sender.address.toString(), nonce.toString())

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

function isTransactionHash(requestId) {
  return isHex(requestId) && requestId.split('').length == 66
}

module.exports = {
  connectToAvN,
  query,
  tx,
  proxy,
  poll
}
