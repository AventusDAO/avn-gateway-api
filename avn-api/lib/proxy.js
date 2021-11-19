'use strict'

const { hexToU8a, u8aToHex, u8aConcat } = require('@polkadot/util')
const common = require('./common.js')

const PAYMENT_CONTEXT = 'authorization for proxy payment'
const SIGNED_TRANSFER_SIGNATURE_CONTEXT = 'authorization for transfer operation'

const transferToken = {
  createAuthorisationSignature: function(_relayer, _signer, _recipient, token, amount, proxyNonce) {
    const signerSuri = common.obtainClientSuri()
    const relayer = common.convertToPublicKeyIfNeeded(_relayer)
    const signer = common.convertToPublicKeyIfNeeded(_signer)
    const recipient = common.convertToPublicKeyIfNeeded(_recipient)

    const dataToSign = {
      context: SIGNED_TRANSFER_SIGNATURE_CONTEXT,
      relayer,
      signer,
      recipient,
      token,
      amount,
      proxyNonce
    }

    const hexEncodedData = this.encodeSignatureData(dataToSign)
    return signData(signerSuri, hexEncodedData)
  },

  encodeSignatureData: function(params) {
    const context = common.registry.createType('Text', params.context)
    const encodedRelayer = common.registry.createType('AccountId', hexToU8a(params.relayer))
    const encodedSigner = common.registry.createType('AccountId', hexToU8a(params.signer))
    const encodedRecipient = common.registry.createType('AccountId', hexToU8a(params.recipient))
    const encodedToken = common.registry.createType('H160', hexToU8a(params.token))
    const encodedAmount = common.registry.createType('u128', params.amount)
    const encodedNonce = common.registry.createType('u64', params.proxyNonce)

    const encodedData = u8aConcat(
      context.toU8a(false),
      encodedRelayer.toU8a(true),
      encodedSigner.toU8a(true),
      encodedRecipient.toU8a(true),
      encodedToken.toU8a(true),
      encodedAmount.toU8a(true),
      encodedNonce.toU8a(true)
    )

    return u8aToHex(encodedData)
  }
}

function generatePaymentAuthorisationSignature(signer, _relayer, signature, amount, paymentNonce) {
  const signerSuri = common.obtainClientSuri()
  const relayer = common.convertToPublicKeyIfNeeded(_relayer)

  const proxyProof = {
    signer,
    relayer,
    signature: {
      Sr25519: signature
    }
  }

  const context = common.registry.createType('Text', PAYMENT_CONTEXT)
  const encodedProxyProof = encodeProxyProof(proxyProof)
  const encodedRelayer = common.registry.createType('AccountId', hexToU8a(relayer))
  const encodedAmount = common.registry.createType('Balance', amount)
  const encodedPaymentNonce = common.registry.createType('u64', paymentNonce)

  const encodedData = u8aConcat(
    context.toU8a(false),
    encodedProxyProof,
    encodedRelayer.toU8a(true),
    encodedAmount.toU8a(true),
    encodedPaymentNonce.toU8a(true)
  )

  const hexEncodedData = u8aToHex(encodedData)
  return signData(signerSuri, hexEncodedData)
}

// Because we don't have a connecting api (with access to the custom types), we can't create a proof object automatically
function encodeProxyProof(proxyProof) {
  const signer = common.registry.createType('AccountId', proxyProof.signer)
  const relayer = common.registry.createType('AccountId', proxyProof.relayer)
  const signature = common.registry.createType('MultiSignature', proxyProof.signature)

  return u8aConcat(signer.toU8a(true), relayer.toU8a(true), signature.toU8a(false))
}

function signData(signerSuri, encodedData) {
  const signer = common.keyring.addFromUri(signerSuri)
  const signature = u8aToHex(signer.sign(encodedData))
  return signature
}

module.exports = {
  transferToken,
  generatePaymentAuthorisationSignature
}
