'use strict';

const common = require('./common.js');
const { u8aToHex, u8aConcat } = require('@polkadot/util');

const FEE_PAYMENT_CONTEXT = 'authorization for proxy payment';
const PROXY_TRANSFER_CONTEXT = 'authorization for transfer operation';
const PROXY_LOWER_CONTEXT = 'authorization for lower operation';
const PROXY_ADD_ETHEREUM_LOG_CONTEXT = 'authorization for add ethereum log operation';
const PROXY_MINT_SINGLE_NFT_CONTEXT = 'authorization for mint single nft operation';
const PROXY_LIST_NFT_OPEN_FOR_SALE_CONTEXT = 'authorization for list nft open for sale operation';
const PROXY_TRANSFER_FIAT_NFT_CONTEXT = 'authorization for transfer fiat nft operation';
const PROXY_CANCEL_LIST_FIAT_NFT_CONTEXT = 'authorization for cancel list fiat nft for sale operation';
const PROXY_BOND_CONTEXT = 'authorization for bond operation';
const PROXY_NOMINATE_CONTEXT = 'authorization for nominate operation';
const PROXY_BOND_EXTRA_CONTEXT = 'authorization for bond extra operation';
const PROXY_UNBOND_CONTEXT = 'authorization for unbond operation';
const PROXY_WITHDRAW_UNBONDED_CONTEXT = 'authorization for withdraw unbonded operation';
const PROXY_PAYOUT_STAKERS_CONTEXT = 'authorization for signed payout stakers operation';

const STASH_REWARD_DESTINATION = 'Stash';

function getProxySignature(transactionType, proxyArgs) {
  switch (transactionType) {
    case 'proxyAvtTransfer':
    case 'proxyTokenTransfer':
      return createProxyTokenTransferSignature(proxyArgs);
    case 'proxyConfirmTokenLift':
      return createProxyConfirmTokenLiftSignature(proxyArgs);
    case 'proxyTokenLower':
      return createProxyTokenLowerSignature(proxyArgs);
    case 'proxyMintSingleNft':
      return createProxyMintSingleNftSignature(proxyArgs);
    case 'proxyListNftOpenForSale':
      return createProxyListNftOpenForSaleSignature(proxyArgs);
    case 'proxyTransferFiatNft':
      return createProxyTransferFiatNftSignature(proxyArgs);
    case 'proxyCancelListFiatNft':
      return createProxyCancelListFiatNftSignature(proxyArgs);
    case 'proxyBond':
      return createProxyBondSignature(proxyArgs);
    case 'proxyNominate':
      return createProxyNominateSignature(proxyArgs);
    case 'proxyIncreaseStake':
      return createProxyIncreaseStakeSignature(proxyArgs);
    case 'proxyUnstake':
      return createProxyUnstakeSignature(proxyArgs);
    case 'proxyWithdrawUnlocked':
      return createProxyWithdrawUnlockedSignature(proxyArgs);
    case 'proxyPayoutStakers':
      return createProxyPayoutStakersSignature(proxyArgs);
    default:
      throw new Error(`No such transaction type: ${transactionType}`);
    }
}

function createProxyTokenTransferSignature(proxyArgs) {
  let { relayer, user, recipient, token, amount, nonce } = proxyArgs;
  relayer = common.convertToPublicKeyIfNeeded(relayer);
  user = common.convertToPublicKeyIfNeeded(user);
  recipient = common.convertToPublicKeyIfNeeded(recipient);

  const dataToSign = {
    context: PROXY_TRANSFER_CONTEXT,
    relayer,
    user,
    recipient,
    token,
    amount,
    nonce
  };

  const hexEncodedData = encodeProxyTransferSignatureData(dataToSign);
  return signData(hexEncodedData);
}

function createProxyConfirmTokenLiftSignature(proxyArgs) {
  let { relayer, eventType, ethereumTransactionHash, nonce } = proxyArgs;
  relayer = common.convertToPublicKeyIfNeeded(relayer);

  const dataToSign = {
    context: PROXY_ADD_ETHEREUM_LOG_CONTEXT,
    relayer,
    eventType,
    ethereumTransactionHash,
    nonce
  };

  const hexEncodedData = encodeProxyConfirmTokenLiftSignatureData(dataToSign);
  return signData(hexEncodedData);
}

function createProxyTokenLowerSignature(proxyArgs) {
  let { relayer, user, t1Recipient, token, amount, nonce } = proxyArgs;
  relayer = common.convertToPublicKeyIfNeeded(relayer);
  user = common.convertToPublicKeyIfNeeded(user);

  const dataToSign = {
    context: PROXY_LOWER_CONTEXT,
    relayer,
    user,
    t1Recipient,
    token,
    amount,
    nonce
  };

  const hexEncodedData = encodeProxyTokenLowerSignatureData(dataToSign);
  return signData(hexEncodedData);
}

function createProxyMintSingleNftSignature(proxyArgs) {
  let { relayer, user, externalRef, royalties, t1Authority } = proxyArgs;
  relayer = common.convertToPublicKeyIfNeeded(relayer);

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

function createProxyListNftOpenForSaleSignature(proxyArgs) {
  let { relayer, user, nftId, market, nonce } = proxyArgs;
  relayer = common.convertToPublicKeyIfNeeded(relayer);

  const dataToSign = {
    context: PROXY_LIST_NFT_OPEN_FOR_SALE_CONTEXT,
    relayer,
    nftId,
    market,
    nonce
  };

  const hexEncodedData = encodeProxyListNftOpenForSaleSignatureData(dataToSign);
  return signData(hexEncodedData);
}

function createProxyTransferFiatNftSignature(proxyArgs) {
  let { relayer, user, nftId, recipient, nonce } = proxyArgs;
  relayer = common.convertToPublicKeyIfNeeded(relayer);
  recipient = common.convertToPublicKeyIfNeeded(recipient);

  const dataToSign = {
    context: PROXY_TRANSFER_FIAT_NFT_CONTEXT,
    relayer,
    nftId,
    recipient,
    nonce
  };

  const hexEncodedData = encodeProxyTransferFiatNftSignature(dataToSign);
  return signData(hexEncodedData);
}

function createProxyCancelListFiatNftSignature(proxyArgs) {
  let { relayer, user, nftId, nonce } = proxyArgs;
  relayer = common.convertToPublicKeyIfNeeded(relayer);

  const dataToSign = {
    context: PROXY_CANCEL_LIST_FIAT_NFT_CONTEXT,
    relayer,
    nftId,
    nonce
  };

  const hexEncodedData = encodeProxyCancelListFiatNftSignature(dataToSign);
  return signData(hexEncodedData);
}

function createFeePaymentSignature(feePaymentArgs) {
  let { relayer, user, proxySignature, relayerFee, nonce } = feePaymentArgs;
  relayer = common.convertToPublicKeyIfNeeded(relayer);

  const proxyProof = {
    signer: user,
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
    nonce
  };

  const hexEncodedData = encodeFeePaymentSignatureData(dataToSign);
  return signData(hexEncodedData);
}

function createProxyBondSignature(proxyArgs) {
  let { relayer, user, amount, nonce } = proxyArgs;
  relayer = common.convertToPublicKeyIfNeeded(relayer);

  let dataToSign = {
    context: PROXY_BOND_CONTEXT,
    relayer,
    controller: common.convertToPublicKeyIfNeeded(user), // stash and controller are the same
    amount,
    payee: STASH_REWARD_DESTINATION, // The reward will be paid into the stash account
    nonce
  };

  const hexEncodedData = encodeBondSignatureData(dataToSign);
  return signData(hexEncodedData);
}

function createProxyNominateSignature(proxyArgs) {
  let { relayer, targets, nonce } = proxyArgs;
  relayer = common.convertToPublicKeyIfNeeded(relayer);

  let dataToSign = {
    context: PROXY_NOMINATE_CONTEXT,
    relayer,
    targets,
    nonce
  };

  const hexEncodedData = encodeNominateSignatureData(dataToSign);
  return signData(hexEncodedData);
}

function createProxyIncreaseStakeSignature(proxyArgs) {
  let { relayer, amount, nonce } = proxyArgs;
  relayer = common.convertToPublicKeyIfNeeded(relayer);

  let dataToSign = {
    context: PROXY_BOND_EXTRA_CONTEXT,
    relayer,
    amount,
    nonce
  };

  const hexEncodedData = encodeIncreaseStakeSignatureData(dataToSign);
  return signData(hexEncodedData);
}

function createProxyUnstakeSignature(proxyArgs) {
  let { relayer, amount, nonce } = proxyArgs;
  relayer = common.convertToPublicKeyIfNeeded(relayer);

  let dataToSign = {
    context: PROXY_UNBOND_CONTEXT,
    relayer,
    amount,
    nonce
  };

  const hexEncodedData = encodeUnstakeSignatureData(dataToSign);
  return signData(hexEncodedData);
}

function createProxyWithdrawUnlockedSignature(proxyArgs) {
  let { relayer, nonce } = proxyArgs;
  relayer = common.convertToPublicKeyIfNeeded(relayer);
  const numSlashSpan = 0; // We dont use slashing

  let dataToSign = {
    context: PROXY_WITHDRAW_UNBONDED_CONTEXT,
    relayer,
    numSlashSpan,
    nonce
  };

  const hexEncodedData = encodeWithdrawUnlockedSignatureData(dataToSign);
  return signData(hexEncodedData);
}

function createProxyPayoutStakersSignature(proxyArgs) {
  let { relayer, eraIndex, nonce } = proxyArgs;
  relayer = common.convertToPublicKeyIfNeeded(relayer);

  let dataToSign = {
    context: PROXY_PAYOUT_STAKERS_CONTEXT,
    relayer,
    eraIndex,
    nonce
  };

  const hexEncodedData = encodePayoutStakersSignatureData(dataToSign);
  return signData(hexEncodedData);
}

function encodeProxyTransferSignatureData(params) {
  const encodedContext = common.registry.createType('Text', params.context);
  const encodedRelayer = common.registry.createType('AccountId', params.relayer);
  const encodedUser = common.registry.createType('AccountId', params.user);
  const encodedRecipient = common.registry.createType('AccountId', params.recipient);
  const encodedToken = common.registry.createType('H160', params.token);
  const encodedAmount = common.registry.createType('u128', params.amount);
  const encodednonce = common.registry.createType('u64', params.nonce);

  const encodedData = u8aConcat(
    encodedContext.toU8a(false),
    encodedRelayer.toU8a(true),
    encodedUser.toU8a(true),
    encodedRecipient.toU8a(true),
    encodedToken.toU8a(true),
    encodedAmount.toU8a(true),
    encodednonce.toU8a(true)
  );

  return u8aToHex(encodedData);
}

function encodeProxyConfirmTokenLiftSignatureData(params) {
  const encodedContext = common.registry.createType('Text', params.context);
  const encodedRelayer = common.registry.createType('AccountId', params.relayer);
  const encodedUser = common.registry.createType('AccountId', params.user);
  const encodedEventType = common.registry.createType('u8', params.eventType);
  const encodedEthereumTransactionHash = common.registry.createType('H256', params.ethereumTransactionHash);
  const encodedNonce = common.registry.createType('u64', params.nonce);

  const encodedData = u8aConcat(
    encodedContext.toU8a(false),
    encodedRelayer.toU8a(true),
    encodedUser.toU8a(true),
    encodedEventType.toU8a(true),
    encodedEthereumTransactionHash.toU8a(true),
    encodedNonce.toU8a(true)
  );

  return u8aToHex(encodedData);
}

function encodeProxyTokenLowerSignatureData(params) {
  const encodedContext = common.registry.createType('Text', params.context);
  const encodedRelayer = common.registry.createType('AccountId', params.relayer);
  const encodedUser = common.registry.createType('AccountId', params.user);
  const encodedToken = common.registry.createType('H160', params.token);
  const encodedAmount = common.registry.createType('u128', params.amount);
  const encodedT1Recipient = common.registry.createType('H160', params.t1Recipient);
  const encodednonce = common.registry.createType('u64', params.nonce);

  const encodedData = u8aConcat(
    encodedContext.toU8a(false),
    encodedRelayer.toU8a(true),
    encodedUser.toU8a(true),
    encodedToken.toU8a(true),
    encodedAmount.toU8a(true),
    encodedT1Recipient.toU8a(true),
    encodednonce.toU8a(true)
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
  const encodedNonce = common.registry.createType('u64', params.nonce);

  const encodedData = u8aConcat(
    encodedContext.toU8a(false),
    encodedRelayer.toU8a(true),
    encodedNftId.toU8a(true),
    encodedMarket.toU8a(true),
    encodedNonce.toU8a(true)
  );

  return u8aToHex(encodedData);
}

function encodeProxyTransferFiatNftSignature(params) {
  const encodedContext = common.registry.createType('Text', params.context);
  const encodedRelayer = common.registry.createType('AccountId', params.relayer);
  const encodedNftId = common.registry.createType('U256', params.nftId);
  const encodedRecipient = common.registry.createType('AccountId', params.recipient);
  const encodedNonce = common.registry.createType('u64', params.nonce);

  const encodedData = u8aConcat(
    encodedContext.toU8a(false),
    encodedRelayer.toU8a(true),
    encodedNftId.toU8a(true),
    encodedRecipient.toU8a(true),
    encodedNonce.toU8a(true)
  );

  return u8aToHex(encodedData);
}

function encodeProxyCancelListFiatNftSignature(params) {
  const encodedContext = common.registry.createType('Text', params.context);
  const encodedRelayer = common.registry.createType('AccountId', params.relayer);
  const encodedNftId = common.registry.createType('U256', params.nftId);
  const encodedNonce = common.registry.createType('u64', params.nonce);

  const encodedData = u8aConcat(
    encodedContext.toU8a(false),
    encodedRelayer.toU8a(true),
    encodedNftId.toU8a(true),
    encodedNonce.toU8a(true)
  );

  return u8aToHex(encodedData);
}

function encodeBondSignatureData(params) {
  const encodedContext = common.registry.createType('Text', params.context);
  const encodedRelayer = common.registry.createType('AccountId', params.relayer);
  const encodedController = common.registry.createType('LookupSource', params.controller);
  const encodedAmount = common.registry.createType('BalanceOf', params.amount);
  const encodedPayee = common.registry.createType('RewardDestination', params.payee);
  const encodedNonce = common.registry.createType('u64', params.nonce);

  const encoded_params = u8aConcat(
    encodedContext.toU8a(false),
    encodedRelayer.toU8a(true),
    encodedController.toU8a(false),
    encodedAmount.toU8a(true),
    encodedPayee.toU8a(false),
    encodedNonce.toU8a(true)
  );

  return u8aToHex(encoded_params);
}

function encodeNominateSignatureData(params) {
  const encodedContext = common.registry.createType('Text', params.context);
  const encodedRelayer = common.registry.createType('AccountId', params.relayer);
  const encodedTargets = common.registry.createType('Vec<LookupSource>', params.targets);
  const encodedNonce = common.registry.createType('u64', params.nonce);

  const encoded_params = u8aConcat(
    encodedContext.toU8a(false),
    encodedRelayer.toU8a(true),
    encodedTargets.toU8a(false),
    encodedNonce.toU8a(true)
  );

  return u8aToHex(encoded_params);
}

function encodeIncreaseStakeSignatureData(params) {
  const encodedContext = common.registry.createType('Text', params.context);
  const encodedRelayer = common.registry.createType('AccountId', params.relayer);
  const encodedAmount = common.registry.createType('BalanceOf', params.amount);
  const encodedNonce = common.registry.createType('u64', params.nonce);

  const encoded_params = u8aConcat(
    encodedContext.toU8a(false),
    encodedRelayer.toU8a(true),
    encodedAmount.toU8a(true),
    encodedNonce.toU8a(true)
  );

  return u8aToHex(encoded_params);
}

function encodeUnstakeSignatureData(params) {
  const encodedContext = common.registry.createType('Text', params.context);
  const encodedRelayer = common.registry.createType('AccountId', params.relayer);
  const encodedAmount = common.registry.createType('BalanceOf', params.amount);
  const encodedNonce = common.registry.createType('u64', params.nonce);

  const encoded_params = u8aConcat(
    encodedContext.toU8a(false),
    encodedRelayer.toU8a(true),
    encodedAmount.toU8a(true),
    encodedNonce.toU8a(true)
  );

  return u8aToHex(encoded_params);
}

function encodeWithdrawUnlockedSignatureData(params) {
  const encodedContext = common.registry.createType('Text', params.context);
  const encodedRelayer = common.registry.createType('AccountId', params.relayer);
  const encodedNumSlashSpan = common.registry.createType('u32', params.numSlashSpan);
  const encodedNonce = common.registry.createType('u64', params.nonce);

  const encoded_params = u8aConcat(
    encodedContext.toU8a(false),
    encodedRelayer.toU8a(true),
    encodedNumSlashSpan.toU8a(true),
    encodedNonce.toU8a(true)
  );

  return u8aToHex(encoded_params);
}

function encodePayoutStakersSignatureData(params) {
  const encodedContext = common.registry.createType('Text', params.context);
  const encodedRelayer = common.registry.createType('AccountId', params.relayer);
  const encodedEraIndex = common.registry.createType('EraIndex', params.eraIndex);
  const encodedNonce = common.registry.createType('u64', params.nonce);

  const encoded_params = u8aConcat(
    encodedContext.toU8a(false),
    encodedRelayer.toU8a(true),
    encodedEraIndex.toU8a(true),
    encodedNonce.toU8a(true)
  );

  return u8aToHex(encoded_params);
}

function encodeFeePaymentSignatureData(params) {
  const encodedContext = common.registry.createType('Text', params.context);
  const encodedProxyProof = encodeProxyProof(params.proxyProof);
  const encodedRelayer = common.registry.createType('AccountId', params.relayer);
  const encodedRelayerFee = common.registry.createType('Balance', params.relayerFee);
  const encodedNonce = common.registry.createType('u64', params.nonce);

  const encodedData = u8aConcat(
    encodedContext.toU8a(false),
    encodedProxyProof,
    encodedRelayer.toU8a(true),
    encodedRelayerFee.toU8a(true),
    encodedNonce.toU8a(true)
  );

  return u8aToHex(encodedData);
}

function encodeProxyProof(params) {
  const user = common.registry.createType('AccountId', params.user);
  const relayer = common.registry.createType('AccountId', params.relayer);
  const signature = common.registry.createType('MultiSignature', params.signature);
  return u8aConcat(user.toU8a(true), relayer.toU8a(true), signature.toU8a(false));
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
  const user = common.getUserAccount();
  const signature = u8aToHex(user.sign(encodedData));
  return signature;
}

module.exports = {
  createFeePaymentSignature,
  createProxyTokenTransferSignature,
  createProxyConfirmTokenLiftSignature,
  createProxyTokenLowerSignature,
  createProxyListNftOpenForSaleSignature,
  createProxyMintSingleNftSignature,
  createProxyTransferFiatNftSignature,
  createProxyCancelListFiatNftSignature,
  createProxyBondSignature,
  createProxyNominateSignature,
  createProxyIncreaseStakeSignature,
  createProxyUnstakeSignature,
  createProxyWithdrawUnlockedSignature,
  createProxyPayoutStakersSignature,
  getProxySignature
};