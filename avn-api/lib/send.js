'use strict';

const common = require('./common.js');
const proxyApi = require('./proxy.js');

const TX_PROCESSING_TIME = 3000;
const NONCE_TYPE = common.NONCE_TYPE;
const TX_TYPE = common.TX_TYPE;
const MARKET = { Ethereum: 1, Fiat: 2 };
const ETHEREUM_LOG_EVENT_TYPE = {
  AddedValidator: 0,
  Lifted: 1,
  NftMint: 2,
  NftTransferTo: 3,
  NftCancelListing: 4,
  NftCancelBatchListing: 5
};

function Send(api, queryApi, avtContractAddress) {
  this.transferAvt = generateFunction(transferAvt, api, queryApi);
  this.transferToken = generateFunction(transferToken, api, queryApi);
  this.confirmTokenLift = generateFunction(confirmTokenLift, api, queryApi);
  this.lowerToken = generateFunction(lowerToken, api, queryApi);
  this.mintSingleNft = generateFunction(mintSingleNft, api, queryApi);
  this.listFiatNftForSale = generateFunction(listFiatNftForSale, api, queryApi);
  this.transferFiatNft = generateFunction(transferFiatNft, api, queryApi);
  this.cancelFiatNftListing = generateFunction(cancelFiatNftListing, api, queryApi);
  this.stake = generateFunction(stake, api, queryApi);
  this.unstake = generateFunction(unstake, api, queryApi);
  this.withdrawUnlocked = generateFunction(withdrawUnlocked, api, queryApi);
  this.payoutStakers = generateFunction(payoutStakers, api, queryApi);
  this.avtContractAddress = avtContractAddress;
  this.nonceMap = {};
  this.feesMap = {};
}

function transferAvt(api, queryApi) {
  return async function (relayer, recipient, amount) {
    common.validateAccount(relayer);
    common.validateAccount(recipient);
    amount = common.validateAndConvertAmountToString(amount);
    const token = this.avtContractAddress;
    const innerArgs = { recipient, token, amount };

    return await this.proxyRequest(api, queryApi, relayer, TX_TYPE.ProxyAvtTransfer, NONCE_TYPE.Token, innerArgs);

}

function transferToken(api, queryApi) {
  return async function (relayer, recipient, token, amount) {
    common.validateAccount(relayer);
    common.validateAccount(recipient);
    common.validateEthereumAddress(token);
    amount = common.validateAndConvertAmountToString(amount);
    const innerArgs = { recipient, token, amount };

    return await this.proxyRequest(api, queryApi, relayer, TX_TYPE.ProxyTokenTransfer, NONCE_TYPE.Token, innerArgs);
  };
}

function confirmTokenLift(api, queryApi) {
  return async function (relayer, ethereumTransactionHash) {
    common.validateAccount(relayer);
    common.validateEthereumTransactionHash(ethereumTransactionHash);
    const eventType = ETHEREUM_LOG_EVENT_TYPE.Lifted;
    const innerArgs = { ethereumTransactionHash, eventType };

    return await this.proxyRequest(api, queryApi, relayer, TX_TYPE.ProxyConfirmTokenLift, NONCE_TYPE.Confirmation, innerArgs);
  };
}

function lowerToken(api, queryApi) {
  return async function (relayer, t1Recipient, token, amount) {
    common.validateAccount(relayer);
    common.validateEthereumAddress(t1Recipient);
    common.validateEthereumAddress(token);
    amount = common.validateAndConvertAmountToString(amount);
    const innerArgs = { t1Recipient, token, amount };

    return await this.proxyRequest(api, queryApi, relayer, TX_TYPE.ProxyTokenLower, NONCE_TYPE.Token, innerArgs);
  };
}

function mintSingleNft(api, queryApi) {
  return async function (relayer, externalRef, royalties, t1Authority) {
    common.validateAccount(relayer);
    common.validateStringIsPopulated(externalRef);
    common.validateRoyalties(royalties);
    common.validateEthereumAddress(t1Authority);
    const innerArgs = { externalRef, royalties, t1Authority };

    return await this.proxyRequest(api, queryApi, relayer, TX_TYPE.ProxyMintSingleNft, NONCE_TYPE.None, innerArgs);
  };
}

function listFiatNftForSale(api, queryApi) {
  return async function (relayer, nftId) {
    common.validateAccount(relayer);
    common.validateNftId(nftId);
    const market = MARKET.Fiat;
    const innerArgs = { nftId, market };

    return await this.proxyRequest(api, queryApi, relayer, TX_TYPE.ProxyListNftOpenForSale, NONCE_TYPE.Nft, innerArgs);
  };
}

function transferFiatNft(api, queryApi) {
  return async function (relayer, _recipient, nftId) {
    common.validateAccount(relayer);
    common.validateAccount(_recipient);
    const recipient = common.convertToPublicKeyIfNeeded(_recipient);
    common.validateNftId(nftId);
    const innerArgs = { nftId, recipient };

    return await this.proxyRequest(api, queryApi, relayer, TX_TYPE.ProxyTransferFiatNft, NONCE_TYPE.Nft, innerArgs);
  };
}

function cancelFiatNftListing(api, queryApi) {
  return async function (relayer, nftId) {
    common.validateAccount(relayer);
    common.validateNftId(nftId);
    const innerArgs = { nftId };

    return await this.proxyRequest(api, queryApi, relayer, TX_TYPE.ProxyCancelListFiatNft, NONCE_TYPE.Nft, innerArgs);
  };
}

function stake(api, queryApi) {
  return async function (relayer, amount) {
    common.validateAccount(relayer);
    amount = common.validateAndConvertAmountToString(amount);

    const user = common.convertToPublicKeyIfNeeded(common.getUserAddress());
    const stakingStatus = await queryApi.getStakingStatus(user);

    if (stakingStatus === common.STAKING_STATUS.isStaking) {
      const innerArgs = { amount };
      return await this.proxyRequest(api, queryApi, relayer, TX_TYPE.ProxyIncreaseStake, NONCE_TYPE.Staking, innerArgs);
    } else {
      const targets = await queryApi.getValidatorsToNominate();
      common.validateStakingTargets(targets);
      const innerArgs = { amount, targets };
      return await this.proxyStakeAvtRequest(api, queryApi, relayer, innerArgs);
    }
  };
}

function unstake(api, queryApi) {
  return async function (relayer, amount) {
    common.validateAccount(relayer);
    amount = common.validateAndConvertAmountToString(amount);
    const innerArgs = { amount };

    return await this.proxyRequest(api, queryApi, relayer, TX_TYPE.ProxyUnstake, NONCE_TYPE.Staking, innerArgs);
  };
}

function withdrawUnlocked(api, queryApi) {
  return async function (relayer) {
    common.validateAccount(relayer);
    const innerArgs = {};

    return await this.proxyRequest(api, queryApi, relayer, TX_TYPE.ProxyWithdrawUnlocked, NONCE_TYPE.Staking, innerArgs);
  };
}

function payoutStakers(api, queryApi) {
  return async function (relayer, eraIndex) {
    common.validateAccount(relayer);

    if (!eraIndex) {
      eraIndex = await queryApi.getActiveEra();

      if (eraIndex === 0) {
        throw new Error("You must wait for at least 1 era to pass before calling this method. Current era index: ", eraIndex);
      }

      eraIndex = eraIndex - 1; // the default is to payout the previous era because the current one won't be ready yet.
    }
    common.validateNumber(eraIndex);
    const innerArgs = { eraIndex };

    return await this.proxyRequest(api, queryApi, relayer, TX_TYPE.ProxyPayoutStakers, NONCE_TYPE.Staking, innerArgs);
  };
}

function generateFunction(functionName, api, queryApi) {
  return functionName(api, queryApi);
}

Send.prototype.proxyRequest = async function (api, queryApi, relayer, transactionType, nonceType, innerArgs, retry) {
  const user = common.getUserAddress();

  let proxyArgs = {};
  if (nonceType === 'none') {
    proxyArgs = { relayer, user };
  if (nonceType === 'nft') {
    nonce = await queryApi.getNftNonce(nftId);
    proxyArgs = { relayer, user, nonce };
  } else {
    nonce = await this.smartNonce(queryApi, user, nonceType, retry);
    proxyArgs = { relayer, user, nonce };
  }

  const proxySignature = proxyApi.getProxySignature(transactionType, Object.assign(proxyArgs, innerArgs));
  const paymentArgs = { relayer, user, proxySignature, transactionType };
  const paymentDetails = await this.getPaymentNonceAndSignature(queryApi, paymentArgs, retry);
  let params = { relayer, user, recipient, token, amount, proxySignature };

  const response = await this.postRequest(api, transactionType, Object.assign(params, paymentDetails), retry);

  if (!response && !retry) {
    retry = true;
    await this.proxyRequest(api, queryApi, relayer, transactionType, innerArgs, retry);
  }

  return response;
}

Send.prototype.proxyStakeAvtRequest = async function (api, queryApi, relayer, amount, targets, retry) {
  const method = 'proxyStakeAvt';
  const user = common.getUserAddress();
  const stakingNonce = await this.smartNonce(queryApi, user, NONCE_TYPE.Staking, retry);
  const proxyArgs = { relayer, user, amount, targets, stakingNonce };
  const [proxyBondSignature, proxyNominateSignature] = proxyApi.createProxyStakeAvtSignatures(proxyArgs);

  let paymentArgs = { relayer, user, proxySignature: proxyBondSignature, transactionType: TX_TYPE.ProxyBond };
  const bondPaymentData = await this.getPaymentNonceAndSignature(queryApi, paymentArgs, retry);

  paymentArgs = { ...paymentArgs, proxySignature: proxyNominateSignature, transactionType: TX_TYPE.ProxyNominate };
  const nominatePaymentData = await this.getPaymentNonceAndSignature(queryApi, paymentArgs, retry);

  const params = {
    relayer,
    user,
    amount,
    proxyBondSignature,
    bondFeePaymentSignature: bondPaymentData.feePaymentSignature,
    bondPaymentNonce: bondPaymentData.paymentNonce,
    bondMethodName: TX_TYPE.ProxyBond,
    targets,
    proxyNominateSignature,
    nominateFeePaymentSignature: nominatePaymentData.feePaymentSignature,
    nominatePaymentNonce: nominatePaymentData.paymentNonce,
    nominateMethodName: TX_TYPE.ProxyNominate
  };

  const response = await this.postRequest(api, method, params, retry);

  if (!response && !retry) {
    retry = true;
    await this.proxyStakeAvtRequest(api, queryApi, relayer, amount, targets, retry);
  }

  return response;
};

Send.prototype.postRequest = async function (api, method, params, retry) {
  if (retry === true) {
    console.log('Request failed - retrying...');
  }

  const endpoint = api.gateway + '/send';
  const response = await api.axios().post(endpoint, { jsonrpc: '2.0', id: api.uuid(), method: method, params: params });

  if (!response || !response.data) {
    throw new Error('Invalid server response');
  }

  if (response.data.result) {
    return response.data.result;
  }

  if (retry === true) {
    throw new Error(`Error processing send after retry: ${JSON.stringify(response.data.error)}`);
  }
};

Send.prototype.smartNonce = async function (queryApi, _account, nonceType, retry) {
  common.validateNonceType(nonceType);
  const account = common.convertToPublicKeyIfNeeded(_account);

  if (this.nonceMap[account] === undefined) {
    this.nonceMap[account] = Object.values(NONCE_TYPE).reduce((o, key) => ({ ...o, [key]: {} }), {});
  }

  const nonceData = this.nonceMap[account][nonceType];
  const updated = Date.now();
  const refreshNonce = nonceData.nonce === undefined || updated - nonceData.updated >= TX_PROCESSING_TIME * 2 || retry === true;
  let nonce = refreshNonce ? parseInt(await queryApi.getNonce(account, nonceType)) : nonceData.nonce + 1;
  this.nonceMap[account][nonceType] = { nonce, updated };
  return nonce.toString();
};

Send.prototype.getRelayerFee = async function (queryApi, relayer, user, transactionType) {
  if (!this.feesMap[relayer]) this.feesMap[relayer] = {};
  if (!this.feesMap[relayer][user]) this.feesMap[relayer][user] = await queryApi.getRelayerFees(relayer, user);
  return this.feesMap[relayer][user][transactionType];
};

Send.prototype.getPaymentNonceAndSignature = async function (queryApi, paymentArgs, retry) {
  const { relayer, user, proxySignature, transactionType } = paymentArgs;
  const paymentNonce = await this.smartNonce(queryApi, user, NONCE_TYPE.Payment, retry);
  const relayerFee = await this.getRelayerFee(queryApi, relayer, user, transactionType);
  const feePaymentArgs = { relayer, user, proxySignature, relayerFee, paymentNonce };
  const feePaymentSignature = proxyApi.createFeePaymentSignature(feePaymentArgs);
  return { paymentNonce, feePaymentSignature };
};

module.exports = Send;
