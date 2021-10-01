'use strict';

const { cryptoWaitReady } = require('@polkadot/util-crypto');
const { hexToU8a, u8aToHex, u8aConcat } = require('@polkadot/util');
const { TypeRegistry } = require('@polkadot/types');
const { Keyring } = require('@polkadot/keyring');

const SIGNING_CONTEXT = 'awt_gateway_api';

const registry = new TypeRegistry();
const keyring = new Keyring({type: 'sr25519'});

async function init() {
    await cryptoWaitReady();

    return {
        generateAwtToken
    };
}

async function generateAwtToken(suri) {
    const tokenOwner = keyring.addFromUri(suri);
    const issuedAt = new Date().toUTCString();
    const avnPublicKey = u8aToHex(tokenOwner.publicKey);

    // Encode the data to sign
    const encodedData = await encodeAvnPublicKeyForSigning(avnPublicKey, issuedAt);

    // Sign the avnPublicKey of the token owner
    const signature = tokenOwner.sign(encodedData);

    // generate the token - base64 encoded
    const payload = {
        pk: avnPublicKey,
        iat: issuedAt,
        sig: u8aToHex(signature)
    };

    const payloadBuff = new Buffer.from(JSON.stringify(payload));
    return payloadBuff.toString('base64');
}

function encodeAvnPublicKeyForSigning(avnPublicKey, issuedAt) {
    const encodedData = u8aConcat(
        registry.createType('Text', SIGNING_CONTEXT).toU8a(false),
        registry.createType('AccountId', hexToU8a(avnPublicKey)).toU8a(true),
        registry.createType('Text', issuedAt).toU8a(false)
    );

    return u8aToHex(encodedData);
}

module.exports = {
    init
};