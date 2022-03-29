'use strict';

const common = require('./common.js');
const { u8aToHex, u8aConcat } = require('@polkadot/util');

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
  'Vec<LookupSource>': false,
  SkipEncode: undefined, // use for pre-encoded values
};

const getProxySignature = (transactionType, proxyArgs) => signatures[transactionType](proxyArgs);

const signatures = {
  proxyAvtTransfer: proxyArgs => signProxyTokenTransfer(proxyArgs),
  proxyTokenTransfer: proxyArgs => signProxyTokenTransfer(proxyArgs),
  proxyConfirmTokenLift: proxyArgs => signProxyConfirmTokenLift(proxyArgs),
  proxyTokenLower: proxyArgs => signProxyTokenLower(proxyArgs),
  proxyMintSingleNft: proxyArgs => signProxyMintSingleNft(proxyArgs),
  proxyListNftOpenForSale: proxyArgs => signProxyListNftOpenForSale(proxyArgs),
  proxyTransferFiatNft: proxyArgs => signProxyTransferFiatNft(proxyArgs),
  proxyCancelListFiatNft: proxyArgs => signProxyCancelListFiatNft(proxyArgs),
  proxyBond: proxyArgs => signProxyBond(proxyArgs),
  proxyNominate: proxyArgs => signProxyNominate(proxyArgs),
  proxyIncreaseStake: proxyArgs => signProxyIncreaseStake(proxyArgs),
  proxyUnstake: proxyArgs => signProxyUnstake(proxyArgs),
  proxyWithdrawUnlocked: proxyArgs => signProxyWithdrawUnlocked(proxyArgs),
  proxyPayoutStakers: proxyArgs => signProxyPayoutStakers(proxyArgs)
};

function signProxyTokenTransfer(proxyArgs) {
  let { relayer, user, recipient, token, amount, nonce } = proxyArgs;
  relayer = common.convertToPublicKeyIfNeeded(relayer);
  user = common.convertToPublicKeyIfNeeded(user);
  recipient = common.convertToPublicKeyIfNeeded(recipient);

  const dataToSign = [
    { Text: 'authorization for transfer operation' },
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

function signProxyConfirmTokenLift(proxyArgs) {
  let { relayer, eventType, ethereumTransactionHash, nonce } = proxyArgs;
  relayer = common.convertToPublicKeyIfNeeded(relayer);

  const dataToSign = [
    { Text: 'authorization for add ethereum log operation' },
    { AccountId: relayer },
    { AccountId: user },
    { u8: eventType },
    { H256: ethereumTransactionHash },
    { u64: nonce }
  ];

  const encodedData = encodeData(dataToSign);
  return signData(encodedData);
}

function signProxyTokenLower(proxyArgs) {
  let { relayer, user, t1Recipient, token, amount, nonce } = proxyArgs;
  relayer = common.convertToPublicKeyIfNeeded(relayer);
  user = common.convertToPublicKeyIfNeeded(user);

  const dataToSign = [
    { Text: 'authorization for lower operation' },
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

function signProxyMintSingleNft(proxyArgs) {
  let { relayer, user, externalRef, royalties, t1Authority } = proxyArgs;
  relayer = common.convertToPublicKeyIfNeeded(relayer);

  const dataToSign = [
    { Text: 'authorization for mint single nft operation' },
    { AccountId: relayer },
    { 'Vec<u8>': externalRef },
    { SkipEncode: encodeRoyalties(royalties) },
    { H160: t1Authority }
  ];

  const encodedData = encodeData(dataToSign);
  return signData(encodedData);
}

function signProxyListNftOpenForSale(proxyArgs) {
  let { relayer, user, nftId, market, nonce } = proxyArgs;
  relayer = common.convertToPublicKeyIfNeeded(relayer);

  const dataToSign = [
    { Text: 'authorization for list nft open for sale operation' },
    { AccountId: relayer },
    { U256: nftId },
    { u8: market },
    { u64: nonce }
  ];

  const encodedData = encodeData(dataToSign);
  return signData(encodedData);
}

function signProxyTransferFiatNft(proxyArgs) {
  let { relayer, user, nftId, recipient, nonce } = proxyArgs;
  relayer = common.convertToPublicKeyIfNeeded(relayer);
  recipient = common.convertToPublicKeyIfNeeded(recipient);

  const dataToSign = [
    { Text: 'authorization for transfer fiat nft operation' },
    { AccountId: relayer },
    { U256: nftId },
    { AccountId: recipient },
    { u64: nonce }
  ];

  const encodedData = encodeData(dataToSign);
  return signData(encodedData);
}

function signProxyCancelListFiatNft(proxyArgs) {
  let { relayer, user, nftId, nonce } = proxyArgs;
  relayer = common.convertToPublicKeyIfNeeded(relayer);

  const dataToSign = [
    { Text: 'authorization for cancel list fiat nft for sale operation' },
    { AccountId: relayer },
    { U256: nftId },
    { u64: nonce }
  ];

  const encodedData = encodeData(dataToSign);
  return signData(encodedData);
}

function signProxyBond(proxyArgs) {
  let { relayer, user, amount, nonce } = proxyArgs;
  relayer = common.convertToPublicKeyIfNeeded(relayer);
  controller = common.convertToPublicKeyIfNeeded(user);

  const dataToSign = [
    { Text: 'authorization for bond operation' },
    { AccountId: relayer },
    { LookupSource: controller },
    { BalanceOf: amount },
    { RewardDestination: 'Stash' },
    { u64: nonce }
  ];

  const encodedData = encodeData(dataToSign);
  return signData(encodedData);
}

function signProxyNominate(proxyArgs) {
  let { relayer, targets, nonce } = proxyArgs;
  relayer = common.convertToPublicKeyIfNeeded(relayer);

  const dataToSign = [
    { Text: 'authorization for nominate operation' },
    { AccountId: relayer },
    { 'Vec<LookupSource>': targets },
    { u64: nonce }
  ];

  const encodedData = encodeData(dataToSign);
  return signData(encodedData);
}

function signProxyIncreaseStake(proxyArgs) {
  let { relayer, amount, nonce } = proxyArgs;
  relayer = common.convertToPublicKeyIfNeeded(relayer);

  const dataToSign = [
    { Text: 'authorization for bond extra operation' },
    { AccountId: relayer },
    { BalanceOf: amount },
    { u64: nonce }
  ];

  const encodedData = encodeData(dataToSign);
  return signData(encodedData);
}

function signProxyUnstake(proxyArgs) {
  let { relayer, amount, nonce } = proxyArgs;
  relayer = common.convertToPublicKeyIfNeeded(relayer);

  const dataToSign = [
    { Text: 'authorization for unbond operation' },
    { AccountId: relayer },
    { BalanceOf: amount },
    { u64: nonce }
  ];

  const encodedData = encodeData(dataToSign);
  return signData(encodedData);
}

function signProxyWithdrawUnlocked(proxyArgs) {
  let { relayer, nonce } = proxyArgs;
  relayer = common.convertToPublicKeyIfNeeded(relayer);
  const numSlashSpan = 0; // We dont use slashing

  const dataToSign = [
    { Text: 'authorization for withdraw unbonded operation' },
    { AccountId: relayer },
    { u32: numSlashSpan },
    { u64: nonce }
  ];

  const encodedData = encodeData(dataToSign);
  return signData(encodedData);
}

function signProxyPayoutStakers(proxyArgs) {
  let { relayer, eraIndex, nonce } = proxyArgs;
  relayer = common.convertToPublicKeyIfNeeded(relayer);

  const dataToSign = [
    { Text: 'authorization for signed payout stakers operation' },
    { AccountId: relayer },
    { EraIndex: eraIndex },
    { u64: nonce }
  ];

  const encodedData = encodeData(dataToSign);
  return signData(encodedData);
}

function getFeePaymentSignature(feePaymentArgs) {
  let { relayer, user, proxySignature, relayerFee, paymentNonce } = feePaymentArgs;
  relayer = common.convertToPublicKeyIfNeeded(relayer);

  const proxyProofData = [{ AccountId: user }, { AccountId: relayer }, { MultiSignature: { Sr25519: proxySignature } }];

  const dataToSign = [
    { Text: 'authorization for proxy payment' },
    { SkipEncode: encodeData(proxyProofData) },
    { AccountId: relayer },
    { Balance: relayerFee },
    { u64: paymentNonce }
  ];

  const encodedData = encodeData(dataToSign);
  return signData(encodedData);
}

function encodeData(data) {
  const encodedData = data.map(d => {
    const [type, value] = Object.entries(d)[0];
    return type === 'SkipEncode' ? value : common.registry.createType(type, value).toU8a(isNumType[type]);
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
  getProxySignature,
  getFeePaymentSignature
};
