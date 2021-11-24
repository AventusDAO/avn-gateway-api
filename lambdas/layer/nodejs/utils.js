const { decodeAddress, encodeAddress } = require('@polkadot/keyring')
const { hexToU8a, isHex, u8aToHex, u8aConcat } = require('@polkadot/util')
const { signatureVerify } = require('@polkadot/util-crypto')
const { TypeRegistry } = require('@polkadot/types')
const registry = new TypeRegistry()
const BN = require('bn.js')
const { validate: uuidValidate } = require('uuid')

const FEE_PAYMENT_CONTEXT = 'authorization for proxy payment'

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

function isValidNonce(nonce) {
  return /^\d+$/.test(nonce) && new BN(nonce).lt(new BN('ffffffffffffffff', 16))
}

function isValidUUID(requestId) {
  return uuidValidate(requestId)
}

function isValidTokenId(tokenId) {
  return isHex(tokenId) && tokenId.split('').length == 42
}

function isValidSignatureFormat(signature) {
  return isHex(signature)
}

function toBnString(val) {
  return typeof val === 'number' || !isHex(val) ? new BN(val).toString() : new BN(val.replace('0x', ''), 16).toString()
}

function logError(msg, callId, reference, data) {
  console.error('Error:', msg, ':User call ID:', callId, ':Error ref:', reference, ':Error data:', JSON.stringify(data))
}

async function verifyFeePaymentAuthorisation(
  signer,
  relayer,
  relayerFee,
  proxyProof,
  feePaymentSignature,
  paymentNonce
) {
  const context = registry.createType('Text', FEE_PAYMENT_CONTEXT)
  const encodedProxyProof = registry.createType('Proof', proxyProof)
  const encodedRelayer = registry.createType('AccountId', relayer)
  const encodedRelayerFee = registry.createType('Balance', relayerFee)
  const encodedPaymentNonce = registry.createType('u64', paymentNonce)

  const encodedData = u8aConcat(
    context.toU8a(false),
    encodedProxyProof.toU8a(false),
    encodedRelayer.toU8a(true),
    encodedRelayerFee.toU8a(true),
    encodedPaymentNonce.toU8a(true)
  )

  const hexEncodedData = u8aToHex(encodedData)
  return signatureVerify(hexEncodedData, feePaymentSignature, signer).isValid
}

module.exports = {
  logError,
  isValidAccountId,
  isValidAmount,
  isValidNonce,
  isValidSignatureFormat,
  isValidTokenId,
  isValidUUID,
  toBnString,
  verifyFeePaymentAuthorisation
}
