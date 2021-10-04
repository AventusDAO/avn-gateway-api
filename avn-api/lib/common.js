'use strict';

const { isHex, u8aToHex } = require('@polkadot/util');
const { TypeRegistry } = require('@polkadot/types');
const { Keyring } = require('@polkadot/keyring');

const registry = new TypeRegistry();
let keyring = new Keyring({ type: 'sr25519' });

function convertToPublicKeyIfNeeded(accountAddressOrPublicKey) {
    if (isAccountPK(accountAddressOrPublicKey)) {
      return accountAddressOrPublicKey;
    } else {
      try {
        let pk = keyring.decodeAddress(accountAddressOrPublicKey);
        return u8aToHex(pk);
      } catch (error) {
        // TODO: handle this better
        console.log('Error converting invalid address', error);
        return null;
      }
    }
  }

  function isAccountPK(accountString) {
    return isHex(accountString)
      && accountString.slice(0,2) === '0x'
      && accountString.slice(2).length === 64
  }

  function obtainClientSuri() {
    return process.env.SURI;
  }

  module.exports = {
    isAccountPK,
    convertToPublicKeyIfNeeded,
    obtainClientSuri,
    keyring,
    registry
  };
