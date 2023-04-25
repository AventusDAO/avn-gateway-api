const { TypeRegistry } = require('@polkadot/types');
const registry = new TypeRegistry();
const { u8aConcat, u8aToHex, isHex } = require('@polkadot/util');
const utils = require('/opt/utils.js');

const FEE_PAYMENT_CONTEXT = 'authorization for proxy payment';

function getPaymentInfo(payerAddress, relayerAddress, relayerFee, feePaymentSignature) {
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
  connectorUrl,
  payerAddress,
  relayerAddress,
  feePaymentSignature,
  transactionType,
  paymentNonce,
  proxyProof
) {
  const relayerFee = await utils.getRelayerFee(connectorUrl, relayerAddress, payerAddress, transactionType);
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

async function getPaymentNonce(connectorUrl, requestId, payer) {
  try {
    const requestParams = {
      requestId,
      payer
    };

    const avnResponse = await utils.axios.post(connectorUrl + 'getPayerPaymentNonce', requestParams);
    if (!avnResponse) throw new Error(`Null response when querying payment nonce for user: ${payer}, id: ${requestId}`);
    if (avnResponse.error) throw new Error(avnResponse.error);

    return utils.toBnString(avnResponse.data);
  } catch (error) {
    throw new Error(`Error getting payment nonce for user ${payer}: ${error.toString()}`);
  }
}

function verifyFeePaymentSignature(payer, relayer, relayerFee, proxyProof, feePaymentSignature, paymentNonce) {
  const encodedData = encodePaymentParams(relayer, relayerFee, paymentNonce, proxyProof);
  return utils.verifySignatureWithOrWithoutWrapping(encodedData, feePaymentSignature, payer);
}

function encodePaymentParams(relayer, relayerFee, paymentNonce, proxyProof) {
  const encodedContext = registry.createType('Text', FEE_PAYMENT_CONTEXT);
  const encodedProxyProof = utils.encodeProxyProof(proxyProof);
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

async function signPaymentInfo(connectorUrl, encodedPaymentInfo, payerUserName) {
  if (!isHex(encodePaymentParams)) encodedPaymentInfo = u8aToHex(encodedPaymentInfo);

  const requestParams = {
    message: encodedPaymentInfo,
    payerUserName: payerUserName
  };

  const avnResponse = await utils.axios.post(connectorUrl + 'signPaymentInfo', requestParams);
  if (!avnResponse || !avnResponse.data)
    throw new Error(`Null response when signing payment info for payer: ${payerAddress}, data: ${encodedPaymentInfo}`);
  if (avnResponse.error) throw new Error(avnResponse.error);

  return avnResponse.data.signature;
}

// Keep alphabetical
module.exports = {
  encodePaymentParams,
  getPaymentInfo,
  getPaymentNonce,
  tryGetPaymentInfo,
  signPaymentInfo,
  verifyFeePaymentSignature
};
