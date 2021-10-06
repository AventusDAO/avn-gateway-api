const { decodeAddress, encodeAddress } = require('@polkadot/keyring');
const { hexToU8a, isHex } = require('@polkadot/util');
const bigInt = require('big-integer');

function isValidAccountIDFormat(accountId) {
  try {
    encodeAddress(isHex(accountId) ? hexToU8a(accountId) : decodeAddress(accountId));
    return true;
  } catch (error) {
    return false;
  }
}

function isValidAmount(amount) {
  if (amount.match(/^[0-9]+$/)) {
    return ! bigInt(amount).isZero();
  } else {
    return false;
  }
}

function isValidRequestId(accountId) {
  let charArray = accountId.split('');
  if (charArray.length !== 66) return false;
  if (charArray.shift() !== '0' || charArray.shift() !== 'x') return false;
  return charArray.every(c => '0123456789abcdefABCDEF'.includes(c));
}

function isValidTokenIdFormat(tokenId) {
  let charArray = tokenId.split('');
  if (charArray.length !== 42) return false;
  if (charArray.shift() !== '0' || charArray.shift() !== 'x') return false;
  return charArray.every(c => '0123456789abcdefABCDEF'.includes(c));
}

module.exports = {
  isValidAccountIDFormat,
  isValidAmount,
  isValidRequestId,
  isValidTokenIdFormat,
}