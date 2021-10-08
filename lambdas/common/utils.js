const { decodeAddress, encodeAddress } = require('@polkadot/keyring');
const { hexToU8a, isHex } = require('@polkadot/util');
const bigInt = require('big-integer');

function isValidAccountId(accountId) {
  try {
    encodeAddress(isHex(accountId) ? hexToU8a(accountId) : decodeAddress(accountId));
    return true;
  } catch (error) {
    return false;
  }
}

function isValidAmount(amount) {
  return amount.match(/^[0-9]+$/) && ! bigInt(amount).isZero();
}

function isValidRequestId(requestId) {
  return isHex(requestId) && requestId.split('').length == 66;
}

function isValidTokenId(tokenId) {
  return isHex(tokenId) && tokenId.split('').length == 42;
}

module.exports = {
  isValidAccountId,
  isValidAmount,
  isValidRequestId,
  isValidTokenId,
}
