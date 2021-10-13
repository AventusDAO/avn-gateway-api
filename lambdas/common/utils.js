const { decodeAddress, encodeAddress } = require('@polkadot/keyring');
const { hexToU8a, isHex } = require('@polkadot/util');
const BN = require('bn.js');

function isValidAccountId(accountId) {
  try {
    encodeAddress(isHex(accountId) ? hexToU8a(accountId) : decodeAddress(accountId));
    return true;
  } catch (error) {
    return false;
  }
}

function isValidAmount(amount) {
  return amount.match(/^[0-9]+$/) && ! new BN(amount).isZero();
}

function isValidRequestId(requestId) {
  return isHex(requestId) && requestId.split('').length == 66;
}

function isValidTokenId(tokenId) {
  return isHex(tokenId) && tokenId.split('').length == 42;
}

function toBnString(val) {
  return (typeof val === 'number' || !isHex(val)) ? new BN(val).toString() : new BN(val.replace('0x',''), 16).toString();
}

module.exports = {
  isValidAccountId,
  isValidAmount,
  isValidRequestId,
  isValidTokenId,
  toBnString,
}
