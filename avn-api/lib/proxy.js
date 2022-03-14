'use strict';

const common = require('./common.js');
const { u8aToHex, u8aConcat } = require('@polkadot/util');
const BN = require('bn.js');

const FEE_PAYMENT_CONTEXT = 'authorization for proxy payment';
const PROXY_TRANSFER_CONTEXT = 'authorization for transfer operation';
const PROXY_LOWER_CONTEXT = 'authorization for lower operation';
const PROXY_MINT_SINGLE_NFT_CONTEXT = 'authorization for mint single nft operation';
const PROXY_LIST_NFT_OPEN_FOR_SALE_CONTEXT = 'authorization for list nft open for sale operation';
const PROXY_TRANSFER_FIAT_NFT_CONTEXT = 'authorization for transfer fiat nft operation';
const PROXY_CANCEL_LIST_FIAT_NFT_CONTEXT = 'authorization for cancel list fiat nft for sale operation';
const PROXY_BOND_CONTEXT = 'authorization for bond operation';
const PROXY_NOMINATE_CONTEXT = 'authorization for nominate operation';
const PROXY_BOND_EXTRA_CONTEXT = 'authorization for bond extra operation';
const PROXY_UNBOND_CONTEXT = 'authorization for unbond operation';

const STASH_REWARD_DESTINATION = 'Stash';

function createProxyTransferSignature(_relayer, _signer, _recipient, token, amount, accountNonce) {
  const relayer = common.convertToPublicKeyIfNeeded(_relayer);
  const signer = common.convertToPublicKeyIfNeeded(_signer);
  const recipient = common.convertToPublicKeyIfNeeded(_recipient);

  const dataToSign = {
    context: PROXY_TRANSFER_CONTEXT,
    relayer,
    signer,
    recipient,
    token,
    amount,
    accountNonce
  };

  const hexEncodedData = encodeProxyTransferSignatureData(dataToSign);
  return signData(hexEncodedData);
}

function createProxyLowerSignature(_relayer, _signer, t1Recipient, token, amount, accountNonce) {
  const relayer = common.convertToPublicKeyIfNeeded(_relayer);
  const signer = common.convertToPublicKeyIfNeeded(_signer);

  const dataToSign = {
    context: PROXY_LOWER_CONTEXT,
    relayer,
    signer,
    t1Recipient,
    token,
    amount,
    accountNonce
  };

  const hexEncodedData = encodeProxyLowerSignatureData(dataToSign);
  return signData(hexEncodedData);
}

function createProxyMintSingleNftSignature(_relayer, signer, externalRef, royalties, t1Authority) {
  const relayer = common.convertToPublicKeyIfNeeded(_relayer);

  const dataToSign = {
    context: PROXY_MINT_SINGLE_NFT_CONTEXT,
    relayer,
    externalRef,
    royalties,
    t1Authority
  };

  const hexEncodedData = encodeProxyMintSingleNftSignatureData(dataToSign);
  return signData(hexEncodedData);
}

function createProxyListNftOpenForSaleSignature(_relayer, signer, nftId, market, nftNonce) {
  const relayer = common.convertToPublicKeyIfNeeded(_relayer);

  const dataToSign = {
    context: PROXY_LIST_NFT_OPEN_FOR_SALE_CONTEXT,
    relayer,
    nftId,
    market,
    nftNonce
  };

  const hexEncodedData = encodeProxyListNftOpenForSaleSignatureData(dataToSign);
  return signData(hexEncodedData);
}

function createProxyTransferFiatNftSignature(_relayer, signer, nftId, _recipient, nftNonce) {
  const relayer = common.convertToPublicKeyIfNeeded(_relayer);
  const recipient = common.convertToPublicKeyIfNeeded(_recipient);

  const dataToSign = {
    context: PROXY_TRANSFER_FIAT_NFT_CONTEXT,
    relayer,
    nftId,
    recipient,
    nftNonce
  };

  const hexEncodedData = encodeProxyTransferFiatNftSignature(dataToSign);
  return signData(hexEncodedData);
}

function createProxyCancelListFiatNftSignature(_relayer, signer, nftId, nftNonce) {
  const relayer = common.convertToPublicKeyIfNeeded(_relayer);

  const dataToSign = {
    context: PROXY_CANCEL_LIST_FIAT_NFT_CONTEXT,
    relayer,
    nftId,
    nftNonce
  };

  const hexEncodedData = encodeProxyCancelListFiatNftSignature(dataToSign);
  return signData(hexEncodedData);
}

function createFeePaymentSignature(_relayer, signer, proxySignature, relayerFee, paymentNonce) {
  const relayer = common.convertToPublicKeyIfNeeded(_relayer);

  const proxyProof = {
    signer,
    relayer,
    signature: {
      Sr25519: proxySignature
    }
  };

  const dataToSign = {
    context: FEE_PAYMENT_CONTEXT,
    proxyProof,
    relayer,
    relayerFee,
    paymentNonce
  };

  const hexEncodedData = encodeFeePaymentSignatureData(dataToSign);
  return signData(hexEncodedData);
}

// first time staking is made up of 2 transactions: Bond + Nominate
function createProxyStakeAvtSignature(_relayer, signer, amount, targets, stakingNonce) {
  const relayer = common.convertToPublicKeyIfNeeded(_relayer);

  let dataToSign = {
    context: PROXY_BOND_CONTEXT,
    relayer,
    controller: common.convertToPublicKeyIfNeeded(signer), // stash and controller are the same
    amount: amount,
    payee: STASH_REWARD_DESTINATION, // The reward will be paid into the stash account
    nonce: stakingNonce
  };

  const hexEncodedBondData = encodeBondSignatureData(dataToSign);
  const hexBondSignature = signData(hexEncodedBondData);

  stakingNonce = new BN(senderProxyNonce).add(BN_ONE);

  dataToSign = {
    context: PROXY_NOMINATE_CONTEXT,
    relayer,
    targets,
    nonce: stakingNonce
  };

  const hexEncodedNominateData = encodeNominateSignatureData(dataToSign);
  const hexNominateSignature = signData(hexEncodedNominateData);

  return {
    hexBondSignature,
    hexNominateSignature
  };
}

function createProxyIncreaseStakeSignature(_relayer, signer, amount, stakingNonce) {
  const relayer = common.convertToPublicKeyIfNeeded(_relayer);

  let dataToSign = {
    context: PROXY_BOND_EXTRA_CONTEXT,
    relayer,
    amount: amount,
    nonce: stakingNonce
  };

  const hexEncodedData = encodeIncreaseStakeSignatureData(dataToSign);
  return signData(hexEncodedData);
}

function createProxyUnstakeSignature(_relayer, amount, stakingNonce) {
  const relayer = common.convertToPublicKeyIfNeeded(_relayer);

  let dataToSign = {
    context: PROXY_UNBOND_CONTEXT,
    relayer,
    amount: amount,
    nonce: stakingNonce
  };

  const hexEncodedData = encodeUnstakeSignatureData(dataToSign);
  return signData(hexEncodedData);
}

function encodeProxyTransferSignatureData(params) {
  const encodedContext = common.registry.createType('Text', params.context);
  const encodedRelayer = common.registry.createType('AccountId', params.relayer);
  const encodedSigner = common.registry.createType('AccountId', params.signer);
  const encodedRecipient = common.registry.createType('AccountId', params.recipient);
  const encodedToken = common.registry.createType('H160', params.token);
  const encodedAmount = common.registry.createType('u128', params.amount);
  const encodedNonce = common.registry.createType('u64', params.accountNonce);

  const encodedData = u8aConcat(
    encodedContext.toU8a(false),
    encodedRelayer.toU8a(true),
    encodedSigner.toU8a(true),
    encodedRecipient.toU8a(true),
    encodedToken.toU8a(true),
    encodedAmount.toU8a(true),
    encodedNonce.toU8a(true)
  );

  return u8aToHex(encodedData);
}

function encodeProxyLowerSignatureData(params) {
  const encodedContext = common.registry.createType('Text', params.context);
  const encodedRelayer = common.registry.createType('AccountId', params.relayer);
  const encodedSigner = common.registry.createType('AccountId', params.signer);
  const encodedToken = common.registry.createType('H160', params.token);
  const encodedAmount = common.registry.createType('u128', params.amount);
  const encodedT1Recipient = common.registry.createType('H160', params.t1Recipient);
  const encodedNonce = common.registry.createType('u64', params.accountNonce);

  const encodedData = u8aConcat(
    encodedContext.toU8a(false),
    encodedRelayer.toU8a(true),
    encodedSigner.toU8a(true),
    encodedToken.toU8a(true),
    encodedAmount.toU8a(true),
    encodedT1Recipient.toU8a(true),
    encodedNonce.toU8a(true)
  );

  return u8aToHex(encodedData);
}

function encodeProxyMintSingleNftSignatureData(params) {
  const encodedContext = common.registry.createType('Text', params.context);
  const encodedRelayer = common.registry.createType('AccountId', params.relayer);
  const encodedExternalRef = common.registry.createType('Vec<u8>', params.externalRef);
  const encodedRoyalties = encodeRoyalty(params.royalties);
  const encodedT1Authority = common.registry.createType('H160', params.t1Authority);

  const encodedData = u8aConcat(
    encodedContext.toU8a(false),
    encodedRelayer.toU8a(true),
    encodedExternalRef.toU8a(false),
    encodedRoyalties,
    encodedT1Authority.toU8a(true)
  );

  return u8aToHex(encodedData);
}

function encodeProxyListNftOpenForSaleSignatureData(params) {
  const encodedContext = common.registry.createType('Text', params.context);
  const encodedRelayer = common.registry.createType('AccountId', params.relayer);
  const encodedNftId = common.registry.createType('U256', params.nftId);
  const encodedMarket = common.registry.createType('u8', params.market);
  const encodedNftNonce = common.registry.createType('u64', params.nftNonce);

  const encodedData = u8aConcat(
    encodedContext.toU8a(false),
    encodedRelayer.toU8a(true),
    encodedNftId.toU8a(true),
    encodedMarket.toU8a(true),
    encodedNftNonce.toU8a(true)
  );

  return u8aToHex(encodedData);
}

function encodeProxyTransferFiatNftSignature(params) {
  const encodedContext = common.registry.createType('Text', params.context);
  const encodedRelayer = common.registry.createType('AccountId', params.relayer);
  const encodedNftId = common.registry.createType('U256', params.nftId);
  const encodedRecipient = common.registry.createType('AccountId', params.recipient);
  const encodedNftNonce = common.registry.createType('u64', params.nftNonce);

  const encodedData = u8aConcat(
    encodedContext.toU8a(false),
    encodedRelayer.toU8a(true),
    encodedNftId.toU8a(true),
    encodedRecipient.toU8a(true),
    encodedNftNonce.toU8a(true)
  );

  return u8aToHex(encodedData);
}

function encodeProxyCancelListFiatNftSignature(params) {
  const encodedContext = common.registry.createType('Text', params.context);
  const encodedRelayer = common.registry.createType('AccountId', params.relayer);
  const encodedNftId = common.registry.createType('U256', params.nftId);
  const encodedNftNonce = common.registry.createType('u64', params.nftNonce);

  const encodedData = u8aConcat(
    encodedContext.toU8a(false),
    encodedRelayer.toU8a(true),
    encodedNftId.toU8a(true),
    encodedNftNonce.toU8a(true)
  );

  return u8aToHex(encodedData);
}

function encodeBondSignatureData(params) {
  const context = common.registry.createType('Text', params.context);
  const relayer = common.registry.createType('AccountId', hexToU8a(params.relayer));
  const controller = common.registry.createType('LookupSource', hexToU8a(params.controller));
  const amount = common.registry.createType('BalanceOf', params.amount);
  const payee = common.registry.createType('RewardDestination', params.payee);
  const nonce = common.registry.createType('u64', params.nonce);

  const encoded_params = u8aConcat(
    context.toU8a(false),
    relayer.toU8a(true),
    controller.toU8a(false),
    amount.toU8a(true),
    payee.toU8a(false),
    nonce.toU8a(true)
  );

  return u8aToHex(encoded_params);
}

function encodeNominateSignatureData(params) {
  const context = common.registry.createType('Text', params.context);
  const relayer = common.registry.createType('AccountId', hexToU8a(params.relayer));
  const targets = common.registry.createType('Vec<LookupSource>', params.targets);
  const nonce = common.registry.createType('u64', params.nonce);

  const encoded_params = u8aConcat(
    context.toU8a(false),
    relayer.toU8a(true),
    targets.toU8a(false),
    nonce.toU8a(true)
  );

  return u8aToHex(encoded_params);
}

function encodeIncreaseStakeSignatureData(params) {
  const context = registry.createType('Text', params.context);
  const relayer = registry.createType('AccountId', hexToU8a(params.relayer));
  const amount = registry.createType('BalanceOf', params.amount);
  const nonce = registry.createType('u64', params.nonce);

  const encoded_params = u8aConcat(
    context.toU8a(false),
    relayer.toU8a(true),
    amount.toU8a(true),
    nonce.toU8a(true)
  );

  return u8aToHex(encoded_params);
}

function encodeUnstakeSignatureData(params) {
  const context = common.registry.createType('Text', params.context);
  const relayer = common.registry.createType('AccountId', hexToU8a(params.relayer));
  const amount = common.registry.createType('BalanceOf', params.amount);
  const nonce = common.registry.createType('u64', params.nonce);

  const encoded_params = u8aConcat(
    context.toU8a(false),
    relayer.toU8a(true),
    amount.toU8a(true),
    nonce.toU8a(true)
  );

  return u8aToHex(encoded_params);
}

function encodeFeePaymentSignatureData(params) {
  const encodedContext = common.registry.createType('Text', params.context);
  const encodedProxyProof = encodeProxyProof(params.proxyProof);
  const encodedRelayer = common.registry.createType('AccountId', params.relayer);
  const encodedRelayerFee = common.registry.createType('Balance', params.relayerFee);
  const encodedPaymentNonce = common.registry.createType('u64', params.paymentNonce);

  const encodedData = u8aConcat(
    encodedContext.toU8a(false),
    encodedProxyProof,
    encodedRelayer.toU8a(true),
    encodedRelayerFee.toU8a(true),
    encodedPaymentNonce.toU8a(true)
  );

  return u8aToHex(encodedData);
}

function encodeProxyProof(params) {
  const signer = common.registry.createType('AccountId', params.signer);
  const relayer = common.registry.createType('AccountId', params.relayer);
  const signature = common.registry.createType('MultiSignature', params.signature);
  return u8aConcat(signer.toU8a(true), relayer.toU8a(true), signature.toU8a(false));
}

function encodeRoyalty(royalties) {
  const encodedRoyalties = royalties.map(r => {
    const recipientT1Address = common.registry.createType('H160', r.recipient_t1_address);
    const partsPerMillion = common.registry.createType('u32', r.rate.parts_per_million);
    return u8aConcat(recipientT1Address.toU8a(true), partsPerMillion.toU8a(true));
  });

  const encodedResult = common.createTypeUnsafe(common.registry, 'Vec<(H160, u32)>', [encodedRoyalties]);
  return encodedResult.toU8a(false);
}

function signData(encodedData) {
  const signer = common.getClientSigner();
  const signature = u8aToHex(signer.sign(encodedData));
  return signature;
}

module.exports = {
  createFeePaymentSignature,
  createProxyTransferSignature,
  createProxyLowerSignature,
  createProxyListNftOpenForSaleSignature,
  createProxyMintSingleNftSignature,
  createProxyTransferFiatNftSignature,
  createProxyCancelListFiatNftSignature,
  createProxyStakeAvtSignature,
  createProxyIncreaseStakeSignature,
  createProxyUnstakeSignature
};
