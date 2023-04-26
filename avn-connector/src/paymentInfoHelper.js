'use strict';

const { TypeRegistry } = require('@polkadot/types');
const { u8aConcat, u8aToHex, stringToHex } = require('@polkadot/util');
const log4js = require('log4js');
const log = log4js.getLogger();

const registry = new TypeRegistry();
const VAULT_PAYER_USERNAME_PREFIX = 'GatewayPayer_';
const FEE_PAYMENT_CONTEXT = 'authorization for proxy payment';


function encodePaymentParams(relayer, relayerFee, paymentNonce, proxyProof) {
  const encodedContext = registry.createType('Text', FEE_PAYMENT_CONTEXT);
  const encodedProxyProof = encodeProxyProof(proxyProof);
  const encodedRelayer = registry.createType('AccountId', relayer);
  const encodedRelayerFee = registry.createType('Balance', relayerFee);
  const encodedPaymentNonce = registry.createType('u64', paymentNonce);

  return u8aConcat(
    encodedContext.toU8a(false),
    encodedProxyProof,
    encodedRelayer.toU8a(true),
    encodedRelayerFee.toU8a(true),
    encodedPaymentNonce.toU8a(true)
  );
}

function encodeProxyProof(params) {
  const user = registry.createType('AccountId', params.signer);
  const relayer = registry.createType('AccountId', params.relayer);
  const signature = registry.createType('MultiSignature', params.signature);
  return u8aConcat(user.toU8a(true), relayer.toU8a(true), signature.toU8a(false));
}

function getPayerVaultUsername(payerVaultId) {
  return `${VAULT_PAYER_USERNAME_PREFIX}${payerVaultId}`;
}

module.exports = {
  encodePaymentParams,
  getPayerVaultUsername
};