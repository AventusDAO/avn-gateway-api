import { TypeRegistry } from '@polkadot/types';
import { u8aConcat, u8aToHex, isHex } from '@polkadot/util';
import { getRelayerFee, verifySignatureWithOrWithoutWrapping, encodeProxyProof } from '/opt/utils';
import { PaymentInfo, ProxyProof, TransactionType } from './types';

const registry = new TypeRegistry();
const FEE_PAYMENT_CONTEXT = 'authorization for proxy payment';

function getPaymentInfo(payerAddress: string, relayerAddress: string, relayerFee: string, feePaymentSignature: string): PaymentInfo {
  return {
    payer: payerAddress,
    recipient: relayerAddress,
    amount: relayerFee,
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
  proxyProof: ProxyProof
): Promise<PaymentInfo> {
  const relayerFee = await getRelayerFee(connectorUrl, relayerAddress, payerAddress, transactionType);

  console.info(`connectorUrl: ${connectorUrl} |
    payerAddress: ${payerAddress} |
    relayerAddress: ${relayerAddress} |
    feePaymentSignature: ${feePaymentSignature} |
    transactionType: ${transactionType} |
    paymentNonce: ${paymentNonce} |
    proxyProof: ${JSON.stringify(proxyProof, null, 2)} |
    relayerFee: ${relayerFee}`
  );

  const isVerified = verifyFeePaymentSignature(
    payerAddress,
    relayerAddress,
    relayerFee,
    proxyProof,
    feePaymentSignature,
    paymentNonce
  );
  if (isVerified === false) {
    throw new Error(`invalid fee authorisation: ${feePaymentSignature}`);
  }
  return getPaymentInfo(payerAddress, relayerAddress, relayerFee, feePaymentSignature);
}

function verifyFeePaymentSignature(
  payer: string,
  relayer: string,
  relayerFee: string,
  proxyProof: ProxyProof,
  feePaymentSignature: string,
  paymentNonce: string
): boolean {
  const encodedData = encodePaymentParams(relayer, relayerFee, paymentNonce, proxyProof);
  console.info(`encodedData: ${JSON.stringify(encodedData, null, 2)}`);
  return verifySignatureWithOrWithoutWrapping(encodedData, feePaymentSignature, payer);
}

function encodePaymentParams(relayer:string, relayerFee:string, paymentNonce:string, proxyProof:ProxyProof):Uint8Array {
  const encodedContext = registry.createType('Text', FEE_PAYMENT_CONTEXT);
  const encodedProxyProof:Uint8Array = encodeProxyProof(proxyProof);
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

// Keep alphabetical
export {
  encodePaymentParams,
  getPaymentInfo,
  tryGetPaymentInfo,
  verifyFeePaymentSignature
};