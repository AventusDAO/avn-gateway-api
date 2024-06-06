'use strict';

import { TypeRegistry } from '@polkadot/types';
import { u8aConcat, u8aToHex, stringToHex } from '@polkadot/util';
const registry = new TypeRegistry();
const VAULT_PAYER_USERNAME_PREFIX = 'GatewayPayer_';
const FEE_PAYMENT_CONTEXT = 'authorization for proxy payment';

interface ProxyProofParams {
  signer: string;
  relayer: string;
  signature: string;
}

function encodePaymentParams(
  relayer: string,
  relayerFee: string,
  paymentNonce: number,
  proxyProof: ProxyProofParams
): Uint8Array {
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

function encodeProxyProof(params: ProxyProofParams): Uint8Array {
  const user = registry.createType('AccountId', params.signer);
  const relayer = registry.createType('AccountId', params.relayer);
  const signature = registry.createType('MultiSignature', params.signature);
  return u8aConcat(
    user.toU8a(true),
    relayer.toU8a(true),
    signature.toU8a(false)
  );
}

function getPayerVaultUsername(payerVaultId: string): string {
  return `${VAULT_PAYER_USERNAME_PREFIX}${payerVaultId}`;
}

const paymentInfoHelper = {
  encodePaymentParams,
  getPayerVaultUsername
};
export default paymentInfoHelper;
