const { decodeAddress, encodeAddress } = require('@polkadot/keyring')
const { hexToU8a, isHex } = require('@polkadot/util')
const BN = require('bn.js')
const { validate: uuidValidate } = require('uuid')

function isPositiveInteger(n) {
  return n >>> 0 === parseFloat(n)
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
  return isPositiveInteger(amount) && !new BN(amount).isZero()
}

function isValidNonce(nonce) {
  return isPositiveInteger(nonce)
}

function isValidUUID(requestId) {
  return uuidValidate(requestId)
}

function isValidTokenId(tokenId) {
  return isHex(tokenId) && tokenId.split('').length == 42
}

function toBnString(val) {
  return typeof val === 'number' || !isHex(val) ? new BN(val).toString() : new BN(val.replace('0x', ''), 16).toString()
}

function isNullOrEmptyString(value) {
  return value ? value.replace(/\s/g, '').length == 0 : true
}

function logError(msg, callId, reference, data) {
  console.error('Error:', msg, ':User call ID:', callId, ':Error ref:', reference, ':Error data:', JSON.stringify(data))
}

module.exports = {
  logError,
  isNullOrEmptyString,
  isValidAccountId,
  isValidAmount,
  isValidNonce,
  isValidTokenId,
  isValidUUID,
  toBnString
}
