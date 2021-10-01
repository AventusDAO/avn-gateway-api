const { cryptoWaitReady } = require('@polkadot/util-crypto');
const { TypeRegistry } = require('@polkadot/types');
const { Keyring } = require('@polkadot/keyring');
const common = require('./common.js');
const { hexToU8a, u8aToHex, u8aConcat } = require('@polkadot/util');

const registry = new TypeRegistry();
let keyring = new Keyring({ type: 'sr25519' });

const SIGNED_TRANSFER_SIGNATURE_CONTEXT = "authorization for transfer operation";
const FIXED_SURI_FOR_TESTS = '0xc47fee6cdb16c0682a97bace7ba78c7b12eccd3b596e9722fd53e035118802aa';
// const FIXED_SURI_FOR_TESTS = 'thing shoulder vague echo under pave absurd cotton crawl tell together embrace'

async function init() {
  await cryptoWaitReady();
}

let transferToken = {
  createAuthorisationSignature:
    function (relayer, from, to, token, amount, nonce) {
      let signerSuri = FIXED_SURI_FOR_TESTS;
      let relayerPublicKey = common.convertToPublicKeyIfNeeded(relayer);
      let senderPublicKey = common.convertToPublicKeyIfNeeded(from);
      let recipientPublicKey = common.convertToPublicKeyIfNeeded(to);

      let dataToSign = {
        context: SIGNED_TRANSFER_SIGNATURE_CONTEXT,
        relayer: relayerPublicKey,
        from: senderPublicKey,
        to: recipientPublicKey,
        token: token,
        amount: amount,
        nonce: nonce,
      };

      let encodedDataInHex = this.encodeSignatureData(dataToSign);
      return signData(signerSuri, encodedDataInHex);
  },

  encodeSignatureData: function(params) {
    const context = registry.createType('Text', params.context);
    const relayer_obj = registry.createType('AccountId', hexToU8a(params.relayer));
    const from_obj = registry.createType('AccountId', hexToU8a(params.from));
    const to_obj = registry.createType('AccountId', hexToU8a(params.to));
    const token_obj = registry.createType('H160', hexToU8a(params.token));
    const amount_obj = registry.createType('u128', params.amount);
    const nonce_obj = registry.createType('u64', params.nonce);

    const encoded_params = u8aConcat(
      context.toU8a(false),
      relayer_obj.toU8a(true),
      from_obj.toU8a(true),
      to_obj.toU8a(true),
      token_obj.toU8a(true),
      amount_obj.toU8a(true),
      nonce_obj.toU8a(true)
    );

    return u8aToHex(encoded_params);
  }
};

function signData(signerSuri, encodedData) {
  const signer = keyring.addFromUri(signerSuri);
  let signature = u8aToHex(signer.sign(encodedData));
  return signature;
}


module.exports = {
  transferToken,
  init
};
