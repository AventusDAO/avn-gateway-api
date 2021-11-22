const { decodeAddress, encodeAddress } = require('@polkadot/keyring')
const { hexToU8a, isHex } = require('@polkadot/util')
const BN = require('bn.js')
const { validate: uuidValidate } = require('uuid')

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

module.exports = {
  logError,
  isValidAccountId,
  isValidAmount,
  isValidNonce,
  isValidSignatureFormat,
  isValidTokenId,
  isValidUUID,
  toBnString
}
