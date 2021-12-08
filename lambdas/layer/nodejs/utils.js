const axios = require('axios')
const { TypeRegistry } = require('@polkadot/types')
const registry = new TypeRegistry()
const { hexToU8a, isHex, u8aToHex, u8aConcat } = require('@polkadot/util')
const { cryptoWaitReady, decodeAddress, encodeAddress, signatureVerify } = require('@polkadot/util-crypto')
const BN = require('bn.js')
const { validate: uuidValidate } = require('uuid')

const SIGNING_CONTEXT = 'awt_gateway_api'
const FEE_PAYMENT_CONTEXT = 'authorization for proxy payment'

let initialised

async function init() {
  if (!initialised) {
    await cryptoWaitReady()
    initialised = true
  }
}

function isValidAccountId(accountId) {
  try {
    encodeAddress(isHex(accountId) ? hexToU8a(accountId) : decodeAddress(accountId))
    return true
  } catch (error) {
    return false
  }
}

function isValidAmount(amount) {
  return /^\d+$/.test(amount) && !new BN(amount).isZero()
}

function isValidNftId(nftId) {
  // TODO:
  return true
}

function isValidMarket(market) {
  return ['0x01', '0x02'].includes(market)
}

function isValidNonce(nonce) {
  return /^\d+$/.test(nonce) && new BN(nonce).lt(new BN('ffffffffffffffff', 16))
}

function isValidUUID(requestId) {
  return uuidValidate(requestId)
}

function isValidEthereumAddress(tokenId) {
  return isHex(tokenId) && tokenId.split('').length == 42
}

function isValidSignatureFormat(signature) {
  return isHex(signature)
}

function isValidString(value) {
  return !(value ? value.replace(/\s/g, '').length == 0 : true)
}

function isValidArray(value) {
  return Array.isArray(value)
}

function toBnString(val) {
  return typeof val === 'number' || !isHex(val) ? new BN(val).toString() : new BN(val.replace('0x', ''), 16).toString()
}

function logError(msg, callId, reference, data) {
  console.error('Error:', msg, ':User call ID:', callId, ':Error ref:', reference, ':Error data:', JSON.stringify(data))
}

function verifyAwtTokenSignature(publicKey, issuedAt, signature) {
  const encodedContext = registry.createType('Text', SIGNING_CONTEXT)
  const encodedPublicKey = registry.createType('AccountId', hexToU8a(publicKey))
  const encodedIssuedAt = registry.createType('Text', issuedAt)
  const encodedData = u8aConcat(encodedContext.toU8a(false), encodedPublicKey.toU8a(true), encodedIssuedAt.toU8a(false))
  return signatureVerify(u8aToHex(encodedData), signature, publicKey).isValid
}

function verifyFeePaymentSignature(signer, relayer, relayerFee, proxyProof, feePaymentSignature, paymentNonce) {
  const encodedContext = registry.createType('Text', FEE_PAYMENT_CONTEXT)
  const encodedProxyProof = encodeProxyProof(proxyProof)
  const encodedRelayer = registry.createType('AccountId', relayer)
  const encodedRelayerFee = registry.createType('Balance', relayerFee)
  const encodedPaymentNonce = registry.createType('u64', paymentNonce)

  const encodedData = u8aConcat(
    encodedContext.toU8a(false),
    encodedProxyProof,
    encodedRelayer.toU8a(true),
    encodedRelayerFee.toU8a(true),
    encodedPaymentNonce.toU8a(true)
  )

  return signatureVerify(u8aToHex(encodedData), feePaymentSignature, signer).isValid
}

function encodeProxyProof(params) {
  const signer = registry.createType('AccountId', params.signer)
  const relayer = registry.createType('AccountId', params.relayer)
  const signature = registry.createType('MultiSignature', params.signature)
  return u8aConcat(signer.toU8a(true), relayer.toU8a(true), signature.toU8a(false))
}

module.exports = {
  axios,
  BN,
  logError,
  init,
  isValidAccountId,
  isValidAmount,
  isValidMarket,
  isValidNftId,
  isValidNonce,
  isValidSignatureFormat,
  isValidEthereumAddress,
  isValidUUID,
  isValidArray,
  isValidString,
  toBnString,
  verifyAwtTokenSignature,
  verifyFeePaymentSignature
}
