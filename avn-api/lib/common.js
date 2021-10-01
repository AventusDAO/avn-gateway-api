const { isHex, u8aToHex } = require('@polkadot/util');
const { Keyring } = require('@polkadot/keyring');
// maybe add support here to obtain the client's suri

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

  module.exports = {
    isAccountPK,
    convertToPublicKeyIfNeeded,
  };
