import { TypeRegistry } from '@polkadot/types';
import { u8aConcat, u8aToHex, isHex } from '@polkadot/util';
import { getRelayerFee, determineFormatAndVerifySignature, encodeProxyProof } from '/opt/utils';
import { PaymentInfo, ProxyProof, TransactionType } from './types';

const registry = new TypeRegistry();
const FEE_PAYMENT_CONTEXT = 'authorization for proxy payment';

function getPaymentInfo(payerAddress: string, relayerAddress: string, relayerFee: string, feePaymentSignature: string, currencyToken: string): PaymentInfo {
  return {
    payer: payerAddress,
    recipient: relayerAddress,
    amount: relayerFee,
    token: currencyToken,
    signature: {
      Sr25519: feePaymentSignature
    }
  };
}

async function tryGetPaymentInfo(
  connectorUrl: string,
  payerAddress: string,
  relayerAddress: string,
  feePaymentSignature: string,
  transactionType: TransactionType,
  paymentNonce: string,
  proxyProof: ProxyProof,
  currencyToken: string,
): Promise<PaymentInfo> {
  const relayerFee = await getRelayerFee(connectorUrl, relayerAddress, payerAddress, transactionType, currencyToken);
  const isVerified = verifyFeePaymentSignature(
    payerAddress,
    relayerAddress,
    relayerFee,
    proxyProof,
    feePaymentSignature,
    paymentNonce,
    currencyToken,
  );

  if (isVerified === false) {
    throw new Error(`invalid fee authorisation: ${feePaymentSignature}`);
  }
  return getPaymentInfo(payerAddress, relayerAddress, relayerFee, feePaymentSignature, currencyToken);
}

function verifyFeePaymentSignature(
  payer: string,
  relayer: string,
  relayerFee: string,
  proxyProof: ProxyProof,
  feePaymentSignature: string,
  paymentNonce: string,
  currencyToken: string,
): boolean {
  const encodedData = encodePaymentParams(relayer, relayerFee, paymentNonce, proxyProof, currencyToken);
  return determineFormatAndVerifySignature(encodedData, feePaymentSignature, payer);
}

function encodePaymentParams(relayer:string, relayerFee:string, paymentNonce:string, proxyProof:ProxyProof, currencyToken: string):Uint8Array {
  const encodedContext = registry.createType('Text', FEE_PAYMENT_CONTEXT);
  const encodedProxyProof:Uint8Array = encodeProxyProof(proxyProof);
  const encodedRelayer = registry.createType('AccountId', relayer);
  const encodedRelayerFee = registry.createType('Balance', relayerFee);
  const encodedCurrency = registry.createType('H160', currencyToken);
  const encodedPaymentNonce = registry.createType('u64', paymentNonce);

  return u8aConcat(
    encodedContext.toU8a(false),
    encodedProxyProof,
    encodedRelayer.toU8a(true),
    encodedRelayerFee.toU8a(true),
    encodedCurrency.toU8a(true),
    encodedPaymentNonce.toU8a(true)
  );
}

// Keep alphabetical
export {
  encodePaymentParams,
  getPaymentInfo,
  tryGetPaymentInfo,
  verifyFeePaymentSignature
};