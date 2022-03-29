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

const isNumType = {
  AccountId: true,
  BalanceOf: true,
  EraIndex: true,
  u8: true,
  u32: true,
  u64: true,
  u128: true,
  U256: true,
  H160: true,
  H256: true,
  LookupSource: false,
  MultiSignature: false,
  RewardDestination: false,
  Text: false,
  'Vec<u8>': false,
  'Vec<LookupSource>': false
};

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

  const dataToSign = [
    { Text: PROXY_TRANSFER_CONTEXT },
    { AccountId: relayer },
    { AccountId: user },
    { AccountId: recipient },
    { H160: token },
    { u128: amount },
    { u64: nonce }
  ];

  const encodedData = encodeData(dataToSign);
  return signData(encodedData);
}

function createProxyConfirmTokenLiftSignature(proxyArgs) {
  let { relayer, eventType, ethereumTransactionHash, nonce } = proxyArgs;
  relayer = common.convertToPublicKeyIfNeeded(relayer);

  const dataToSign = [
    { Text: PROXY_ADD_ETHEREUM_LOG_CONTEXT },
    { AccountId: relayer },
    { AccountId: user },
    { u8: eventType },
    { H256: ethereumTransactionHash },
    { u64: nonce }
  ];

  const encodedData = encodeData(dataToSign);
  return signData(encodedData);
}

function createProxyTokenLowerSignature(proxyArgs) {
  let { relayer, user, t1Recipient, token, amount, nonce } = proxyArgs;
  relayer = common.convertToPublicKeyIfNeeded(relayer);
  user = common.convertToPublicKeyIfNeeded(user);

  const dataToSign = [
    { Text: PROXY_LOWER_CONTEXT },
    { AccountId: relayer },
    { AccountId: user },
    { H160: token },
    { u128: amount },
    { H160: t1Recipient },
    { u64: nonce }
  ];

  const encodedData = encodeData(dataToSign);
  return signData(encodedData);
}

function createProxyMintSingleNftSignature(proxyArgs) {
  let { relayer, user, externalRef, royalties, t1Authority } = proxyArgs;
  relayer = common.convertToPublicKeyIfNeeded(relayer);

  const dataToSign = [
    { Text: PROXY_MINT_SINGLE_NFT_CONTEXT },
    { AccountId: relayer },
    { 'Vec<u8>': externalRef },
    { SkipFurtherEncode: encodeRoyalties(royalties) },
    { H160: t1Authority }
  ];

  const encodedData = encodeData(dataToSign);
  return signData(encodedData);
}

function createProxyListNftOpenForSaleSignature(proxyArgs) {
  let { relayer, user, nftId, market, nonce } = proxyArgs;
  relayer = common.convertToPublicKeyIfNeeded(relayer);

  const dataToSign = [
    { Text: PROXY_LIST_NFT_OPEN_FOR_SALE_CONTEXT },
    { AccountId: relayer },
    { U256: nftId },
    { u8: market },
    { u64: nonce }
  ];

  const encodedData = encodeData(dataToSign);
  return signData(encodedData);
}

function createProxyTransferFiatNftSignature(proxyArgs) {
  let { relayer, user, nftId, recipient, nonce } = proxyArgs;
  relayer = common.convertToPublicKeyIfNeeded(relayer);
  recipient = common.convertToPublicKeyIfNeeded(recipient);

  const dataToSign = [
    { Text: PROXY_TRANSFER_FIAT_NFT_CONTEXT },
    { AccountId: relayer },
    { U256: nftId },
    { AccountId: recipient },
    { u64: nonce }
  ];

  const encodedData = encodeData(dataToSign);
  return signData(encodedData);
}

function createProxyCancelListFiatNftSignature(proxyArgs) {
  let { relayer, user, nftId, nonce } = proxyArgs;
  relayer = common.convertToPublicKeyIfNeeded(relayer);

  const dataToSign = [{ Text: PROXY_CANCEL_LIST_FIAT_NFT_CONTEXT }, { AccountId: relayer }, { U256: nftId }, { u64: nonce }];

  const encodedData = encodeData(dataToSign);
  return signData(encodedData);
}

function createFeePaymentSignature(feePaymentArgs) {
  let { relayer, user, proxySignature, relayerFee, paymentNonce } = feePaymentArgs;
  relayer = common.convertToPublicKeyIfNeeded(relayer);
  const signer = user;
  const signature = { Sr25519: proxySignature }

  const proxyProofData = [{ AccountId: signer }, { AccountId: relayer }, { MultiSignature: signature }];

  const dataToSign = [
    { Text: FEE_PAYMENT_CONTEXT },
    { SkipFurtherEncode: encodeData(proxyProofData) },
    { AccountId: relayer },
    { Balance: relayerFee },
    { u64: paymentNonce }
  ];

  const encodedData = encodeData(dataToSign);
  return signData(encodedData);
}

function createProxyBondSignature(proxyArgs) {
  let { relayer, user, amount, nonce } = proxyArgs;
  relayer = common.convertToPublicKeyIfNeeded(relayer);
  controller = common.convertToPublicKeyIfNeeded(user);

  const dataToSign = [
    { Text: PROXY_BOND_CONTEXT },
    { AccountId: relayer },
    { LookupSource: controller },
    { BalanceOf: amount },
    { RewardDestination: STASH_REWARD_DESTINATION },
    { u64: nonce }
  ];

  const encodedData = encodeData(dataToSign);
  return signData(encodedData);
}

function createProxyNominateSignature(proxyArgs) {
  let { relayer, targets, nonce } = proxyArgs;
  relayer = common.convertToPublicKeyIfNeeded(relayer);

  const dataToSign = [
    { Text: PROXY_NOMINATE_CONTEXT },
    { AccountId: relayer },
    { 'Vec<LookupSource>': targets },
    { u64: nonce }
  ];

  const encodedData = encodeData(dataToSign);
  return signData(encodedData);
}

function createProxyIncreaseStakeSignature(proxyArgs) {
  let { relayer, amount, nonce } = proxyArgs;
  relayer = common.convertToPublicKeyIfNeeded(relayer);

  const dataToSign = [{ Text: PROXY_BOND_EXTRA_CONTEXT }, { AccountId: relayer }, { BalanceOf: amount }, { u64: nonce }];

  const encodedData = encodeData(dataToSign);
  return signData(encodedData);
}

function createProxyUnstakeSignature(proxyArgs) {
  let { relayer, amount, nonce } = proxyArgs;
  relayer = common.convertToPublicKeyIfNeeded(relayer);

  const dataToSign = [{ Text: PROXY_UNBOND_CONTEXT }, { AccountId: relayer }, { BalanceOf: amount }, { u64: nonce }];

  const encodedData = encodeData(dataToSign);
  return signData(encodedData);
}

function createProxyWithdrawUnlockedSignature(proxyArgs) {
  let { relayer, nonce } = proxyArgs;
  relayer = common.convertToPublicKeyIfNeeded(relayer);
  const numSlashSpan = 0; // We dont use slashing

  const dataToSign = [{ Text: PROXY_WITHDRAW_UNBONDED_CONTEXT }, { AccountId: relayer }, { u32: numSlashSpan }, { u64: nonce }];

  const encodedData = encodeData(dataToSign);
  return signData(encodedData);
}

function createProxyPayoutStakersSignature(proxyArgs) {
  let { relayer, eraIndex, nonce } = proxyArgs;
  relayer = common.convertToPublicKeyIfNeeded(relayer);

  const dataToSign = [{ Text: PROXY_PAYOUT_STAKERS_CONTEXT }, { AccountId: relayer }, { EraIndex: eraIndex }, { u64: nonce }];

  const encodedData = encodeData(dataToSign);
  return signData(encodedData);
}

function encodeData(data) {
  const encodedData = data.map(d => {
    const [type, value] = Object.entries(d)[0];
    return type === 'SkipFurtherEncode' ? value : common.registry.createType(type, value).toU8a(isNumType[type]);
  });
  return u8aConcat(...encodedData);
}

function encodeRoyalties(royalties) {
  const encodedRoyalties = royalties.map(r => {
    const dataToSign = [{ H160: r.recipient_t1_address }, { u32: r.rate.parts_per_million }];
    return encodeData(dataToSign);
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