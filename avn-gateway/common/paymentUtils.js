const { TypeRegistry } = require('@polkadot/types');
const registry = new TypeRegistry();
const { u8aConcat } = require('@polkadot/util');
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

async function getSplitFeePaymentParams(connectorUrl, call) {
  if (!call) return undefined;

  const { relayer, user, proxySignature } = call.params;
  const proxyProof = utils.getProxyProof(user, relayer, proxySignature);
  const relayerFee = await utils.getRelayerFee(connectorUrl, relayer, call.splitFeePayerAddress, call.method);
  const paymentNonce = await getPaymentNonce(connectorUrl, `${call.id}:${call.awsRequestId}`, call.splitFeePayerAddress);
  return {
    relayer,
    relayerFee,
    paymentNonce,
    proxyProof
  }
}

async function getPaymentNonce(connectorUrl, requestId, payer) {
  try {
    const requestParams = {
      callId: requestId,
      palletName: 'avnProxy',
      storageName: 'paymentNonces',
      params: [payer]
    };

    const avnResponse = await utils.axios.post(connectorUrl + 'avnQuery', requestParams);
    if (!avnResponse) throw new Error(`Null response when querying payment nonce for user: ${payer}, id: ${requestId}`);
    if (avnResponse.error) throw new Error(avnResponse.error);

    return utils.toBnString(avnResponse.data);

  } catch (error) {
    throw new Error(`Error getting payment nonce for user ${payer}: ${error.toString()}`);
  }
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

// Keep alphabetical
module.exports = {
  encodePaymentParams,
  getPaymentInfo,
  getPaymentNonce,
  getSplitFeePaymentParams
};