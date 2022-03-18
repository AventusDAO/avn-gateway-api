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

    return await this.proxyTransfer(api, queryApi, relayer, recipient, this.avtContractAddress, amount);
  };
}

function transferToken(api, queryApi) {
  return async function (relayer, recipient, token, amount) {
    common.validateAccount(relayer);
    common.validateAccount(recipient);
    common.validateEthereumAddress(token);
    amount = common.validateAndConvertAmountToString(amount);

    return await this.proxyTransfer(api, queryApi, relayer, recipient, token, amount);
  };
}

function confirmTokenLift(api, queryApi) {
  return async function (relayer, ethereumTransactionHash) {
    common.validateAccount(relayer);
    common.validateEthereumTransactionHash(ethereumTransactionHash);

    return await this.proxyConfirmTokenLift(api, queryApi, relayer, ethereumTransactionHash);
  };
}

function lowerToken(api, queryApi) {
  return async function (relayer, t1Recipient, token, amount) {
    common.validateAccount(relayer);
    common.validateEthereumAddress(t1Recipient);
    common.validateEthereumAddress(token);
    amount = common.validateAndConvertAmountToString(amount);

    return await this.proxyTokenLower(api, queryApi, relayer, t1Recipient, token, amount);
  };
}

function mintSingleNft(api, queryApi) {
  return async function (relayer, externalRef, royalties, t1Authority) {
    common.validateAccount(relayer);
    common.validateStringIsPopulated(externalRef);
    common.validateRoyalties(royalties);
    common.validateEthereumAddress(t1Authority);

    return await this.proxyMintSingleNft(api, queryApi, relayer, externalRef, royalties, t1Authority);
  };
}

function listFiatNftForSale(api, queryApi) {
  return async function (relayer, nftId) {
    common.validateAccount(relayer);
    common.validateNftId(nftId);
    const market = MARKET.Fiat;

    return await this.proxyListNftOpenForSale(api, queryApi, relayer, nftId, market);
  };
}

function transferFiatNft(api, queryApi) {
  return async function (relayer, _recipient, nftId) {
    common.validateAccount(relayer);
    common.validateAccount(_recipient);
    const recipient = common.convertToPublicKeyIfNeeded(_recipient);
    common.validateNftId(nftId);

    return await this.proxyTransferFiatNft(api, queryApi, relayer, nftId, recipient);
  };
}

function cancelFiatNftListing(api, queryApi) {
  return async function (relayer, nftId) {
    common.validateAccount(relayer);
    common.validateNftId(nftId);

    return await this.proxyCancelListFiatNft(api, queryApi, relayer, nftId);
  };
}

function stake(api, queryApi) {
  return async function (relayer, amount) {
    common.validateAccount(relayer);
    amount = common.validateAndConvertAmountToString(amount);

    const signer = common.convertToPublicKeyIfNeeded(common.getClientAddress());
    const stakingStatus = await queryApi.getStakingStatus(signer);

    if (stakingStatus === common.STAKING_STATUS.isStaking) {
      return await this.proxyIncreaseStake(api, queryApi, relayer, amount);
    } else {
      const targets = await queryApi.getValidatorsToNominate();
      common.validateStakingTargets(targets);
      return await this.proxyStakeAvt(api, queryApi, relayer, amount, targets);
    }
  };
}

function unstake(api, queryApi) {
  return async function (relayer, amount) {
    common.validateAccount(relayer);
    amount = common.validateAndConvertAmountToString(amount);

    return await this.proxyUnstakeAvt(api, queryApi, relayer, amount);
  };
}

function withdrawUnlocked(api, queryApi) {
  return async function (relayer) {
    common.validateAccount(relayer);

    return await this.proxyWithdrawUnlocked(api, queryApi, relayer);
  };
}

function payoutStakers(api, queryApi) {
  return async function (relayer, eraIndex) {
    common.validateAccount(relayer);

    if (!eraIndex) {
      eraIndex = await queryApi.getActiveEra();
      eraIndex = eraIndex === 0 ? 0 : eraIndex - 1; // the default is to payout the previous era because the current one won't be ready yet.
    }
    common.validateNumber(eraIndex);

    return await this.proxyPayoutStakers(api, queryApi, relayer, eraIndex);
  };
}

function generateFunction(functionName, api, queryApi) {
  return functionName(api, queryApi);
}

Send.prototype.proxyTransfer = async function (api, queryApi, relayer, recipient, token, amount, retry) {
  const transactionType = token === this.avtContractAddress ? TX_TYPE.ProxyAvtTransfer : TX_TYPE.ProxyTokenTransfer;
  const signer = common.getClientAddress();
  const tokenNonce = await this.smartNonce(queryApi, signer, NONCE_TYPE.Token, retry);
  const proxySignature = proxyApi.createProxyTransferSignature(relayer, signer, recipient, token, amount, tokenNonce);
  const paymentArgs = { relayer, signer, proxySignature, transactionType };
  const { paymentNonce, feePaymentSignature } = await this.getPaymentNonceAndSignature(queryApi, paymentArgs, retry);
  const params = { relayer, signer, recipient, token, amount, proxySignature, feePaymentSignature, paymentNonce };
  const response = await this.postRequest(api, transactionType, retry, params);

  if (!response && !retry) {
    retry = true;
    await this.proxyTransfer(api, queryApi, relayer, recipient, token, amount, retry);
  }

  return response;
};

Send.prototype.proxyConfirmTokenLift = async function (api, queryApi, relayer, ethereumTransactionHash, retry) {
  const transactionType = TX_TYPE.ProxyConfirmTokenLift;
  const eventType = ETHEREUM_LOG_EVENT_TYPE.Lifted;
  const signer = common.getClientAddress();
  const confirmationNonce = await this.smartNonce(queryApi, signer, NONCE_TYPE.Confirmation, retry);
  const proxySignature = proxyApi.createProxyConfirmTokenLiftSignature(
    relayer,
    eventType,
    ethereumTransactionHash,
    confirmationNonce
  );
  const paymentArgs = { relayer, signer, proxySignature, transactionType };
  const { paymentNonce, feePaymentSignature } = await this.getPaymentNonceAndSignature(queryApi, paymentArgs, retry);
  const params = { relayer, signer, eventType, ethereumTransactionHash, proxySignature, feePaymentSignature, paymentNonce };
  const response = await this.postRequest(api, transactionType, retry, params);

  if (!response && !retry) {
    retry = true;
    await this.proxyConfirmTokenLift(api, queryApi, relayer, ethereumTransactionHash, retry);
  }

  return response;
};

Send.prototype.proxyTokenLower = async function (api, queryApi, relayer, t1Recipient, token, amount, retry) {
  const transactionType = TX_TYPE.ProxyTokenLower;
  const signer = common.getClientAddress();
  const tokenNonce = await this.smartNonce(queryApi, signer, NONCE_TYPE.Token, retry);
  const proxySignature = proxyApi.createProxyTokenLowerSignature(relayer, signer, t1Recipient, token, amount, tokenNonce);
  const paymentArgs = { relayer, signer, proxySignature, transactionType };
  const { paymentNonce, feePaymentSignature } = await this.getPaymentNonceAndSignature(queryApi, paymentArgs, retry);
  const params = { relayer, signer, t1Recipient, token, amount, proxySignature, feePaymentSignature, paymentNonce };
  const response = await this.postRequest(api, transactionType, retry, params);

  if (!response && !retry) {
    retry = true;
    await this.proxyTokenLower(api, queryApi, relayer, t1Recipient, token, amount, retry);
  }

  return response;
};

Send.prototype.proxyListNftOpenForSale = async function (api, queryApi, relayer, nftId, market, retry) {
  const transactionType = TX_TYPE.ProxyListNftOpenForSale;
  const signer = common.getClientAddress();
  const nftNonce = await queryApi.getNftNonce(nftId);
  const proxySignature = proxyApi.createProxyListNftOpenForSaleSignature(relayer, signer, nftId, market, nftNonce);
  const paymentArgs = { relayer, signer, proxySignature, transactionType };
  const { paymentNonce, feePaymentSignature } = await this.getPaymentNonceAndSignature(queryApi, paymentArgs, retry);
  const params = { relayer, signer, nftId, market, proxySignature, feePaymentSignature, paymentNonce };
  const response = await this.postRequest(api, transactionType, retry, params);

  if (!response && !retry) {
    retry = true;
    await this.proxyListNftOpenForSale(api, queryApi, relayer, nftId, market, retry);
  }

  return response;
};

Send.prototype.proxyMintSingleNft = async function (api, queryApi, relayer, externalRef, royalties, t1Authority, retry) {
  const transactionType = TX_TYPE.ProxyMintSingleNft;
  const signer = common.getClientAddress();
  const proxySignature = proxyApi.createProxyMintSingleNftSignature(relayer, signer, externalRef, royalties, t1Authority);
  const paymentArgs = { relayer, signer, proxySignature, transactionType };
  const { paymentNonce, feePaymentSignature } = await this.getPaymentNonceAndSignature(queryApi, paymentArgs, retry);
  const params = { relayer, signer, externalRef, royalties, t1Authority, proxySignature, feePaymentSignature, paymentNonce };
  const response = await this.postRequest(api, transactionType, retry, params);

  if (!response && !retry) {
    retry = true;
    await this.proxyMintSingleNft(api, queryApi, relayer, externalRef, royalties, t1Authority, retry);
  }

  return response;
};

Send.prototype.proxyTransferFiatNft = async function (api, queryApi, relayer, nftId, recipient, retry) {
  const transactionType = TX_TYPE.ProxyTransferFiatNft;
  const signer = common.getClientAddress();
  const nftNonce = await queryApi.getNftNonce(nftId);
  const proxySignature = proxyApi.createProxyTransferFiatNftSignature(relayer, signer, nftId, recipient, nftNonce);
  const paymentArgs = { relayer, signer, proxySignature, transactionType };
  const { paymentNonce, feePaymentSignature } = await this.getPaymentNonceAndSignature(queryApi, paymentArgs, retry);
  const params = { relayer, signer, nftId, recipient, proxySignature, feePaymentSignature, paymentNonce };
  const response = await this.postRequest(api, transactionType, retry, params);

  if (!response && !retry) {
    retry = true;
    await this.proxyTransferFiatNft(api, queryApi, relayer, nftId, recipient, retry);
  }

  return response;
};

Send.prototype.proxyCancelListFiatNft = async function (api, queryApi, relayer, nftId, retry) {
  const transactionType = TX_TYPE.ProxyCancelListFiatNft;
  const signer = common.getClientAddress();
  const nftNonce = await queryApi.getNftNonce(nftId);
  const proxySignature = proxyApi.createProxyCancelListFiatNftSignature(relayer, signer, nftId, nftNonce);
  const paymentArgs = { relayer, signer, proxySignature, transactionType };
  const { paymentNonce, feePaymentSignature } = await this.getPaymentNonceAndSignature(queryApi, paymentArgs, retry);
  const params = { relayer, signer, nftId, proxySignature, feePaymentSignature, paymentNonce };
  const response = await this.postRequest(api, transactionType, retry, params);

  if (!response && !retry) {
    retry = true;
    await this.proxyCancelListFiatNft(api, queryApi, relayer, nftId, retry);
  }

  return response;
};

Send.prototype.proxyStakeAvt = async function (api, queryApi, relayer, amount, targets, retry) {
  const method = 'proxyStakeAvt';
  const signer = common.getClientAddress();
  const tokenNonce = await this.smartNonce(queryApi, signer, NONCE_TYPE.Staking, retry);
  const [proxyBondSignature, proxyNominateSignature] = proxyApi.createProxyStakeAvtSignature(
    relayer,
    signer,
    amount,
    targets,
    tokenNonce
  );

  let paymentArgs = { relayer, signer, proxySignature: proxyBondSignature, transactionType: TX_TYPE.ProxyBond };
  const bondPaymentData = await this.getPaymentNonceAndSignature(queryApi, paymentArgs, retry);

  paymentArgs = { ...paymentArgs, proxySignature: proxyNominateSignature, transactionType: TX_TYPE.ProxyNominate };
  const nominatePaymentData = await this.getPaymentNonceAndSignature(queryApi, paymentArgs, retry);

  const params = {
    relayer,
    signer,
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

  const response = await this.postRequest(api, method, retry, params);

  if (!response && !retry) {
    retry = true;
    await this.proxyStakeAvt(api, queryApi, relayer, amount, targets, retry);
  }

  return response;
};

Send.prototype.proxyIncreaseStake = async function (api, queryApi, relayer, amount, retry) {
  const transactionType = TX_TYPE.ProxyIncreaseStake;
  const signer = common.getClientAddress();
  const tokenNonce = await this.smartNonce(queryApi, signer, NONCE_TYPE.Staking, retry);
  const proxySignature = proxyApi.createProxyIncreaseStakeSignature(relayer, amount, tokenNonce);
  const paymentArgs = { relayer, signer, proxySignature, transactionType };
  const { paymentNonce, feePaymentSignature } = await this.getPaymentNonceAndSignature(queryApi, paymentArgs, retry);
  const params = { relayer, signer, amount, proxySignature, feePaymentSignature, paymentNonce };
  const response = await this.postRequest(api, transactionType, retry, params);

  if (!response && !retry) {
    retry = true;
    await this.proxyIncreaseStake(api, queryApi, relayer, amount, retry);
  }

  return response;
};

Send.prototype.proxyUnstakeAvt = async function (api, queryApi, relayer, amount, retry) {
  const transactionType = TX_TYPE.ProxyUnstake;
  const signer = common.getClientAddress();
  const tokenNonce = await this.smartNonce(queryApi, signer, NONCE_TYPE.Staking, retry);
  const proxySignature = proxyApi.createProxyUnstakeSignature(relayer, amount, tokenNonce);
  const paymentArgs = { relayer, signer, proxySignature, transactionType };
  const { paymentNonce, feePaymentSignature } = await this.getPaymentNonceAndSignature(queryApi, paymentArgs, retry);
  const params = { relayer, signer, amount, proxySignature, feePaymentSignature, paymentNonce };
  const response = await this.postRequest(api, transactionType, retry, params);

  if (!response && !retry) {
    retry = true;
    await this.proxyUnstakeAvt(api, queryApi, relayer, amount, retry);
  }

  return response;
};

Send.prototype.proxyWithdrawUnlocked = async function (api, queryApi, relayer, retry) {
  const transactionType = TX_TYPE.ProxyWithdrawUnlocked;
  const signer = common.getClientAddress();
  const tokenNonce = await this.smartNonce(queryApi, signer, NONCE_TYPE.Staking, retry);
  const proxySignature = proxyApi.createProxyWithdrawUnlockedSignature(relayer, tokenNonce);
  const paymentArgs = { relayer, signer, proxySignature, transactionType };
  const { paymentNonce, feePaymentSignature } = await this.getPaymentNonceAndSignature(queryApi, paymentArgs, retry);
  const params = { relayer, signer, proxySignature, feePaymentSignature, paymentNonce };
  const response = await this.postRequest(api, transactionType, retry, params);

  if (!response && !retry) {
    retry = true;
    await this.proxyWithdrawUnlocked(api, queryApi, relayer, retry);
  }

  return response;
};

Send.prototype.proxyPayoutStakers = async function (api, queryApi, relayer, era, retry) {
  const transactionType = TX_TYPE.ProxyPayoutStakers;
  const signer = common.getClientAddress();
  const tokenNonce = await this.smartNonce(queryApi, signer, NONCE_TYPE.Staking, retry);
  const proxySignature = proxyApi.createProxyPayoutStakersSignature(relayer, era, tokenNonce);
  const paymentArgs = { relayer, signer, proxySignature, transactionType };
  const { paymentNonce, feePaymentSignature } = await this.getPaymentNonceAndSignature(queryApi, paymentArgs, retry);
  const params = { relayer, signer, era, proxySignature, feePaymentSignature, paymentNonce };
  const response = await this.postRequest(api, transactionType, retry, params);

  if (!response && !retry) {
    retry = true;
    await this.proxyPayoutStakers(api, queryApi, relayer, era, retry);
  }

  return response;
};

Send.prototype.postRequest = async function (api, method, retry, params) {
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
  const { relayer, signer, proxySignature, transactionType } = paymentArgs;
  const paymentNonce = await this.smartNonce(queryApi, signer, NONCE_TYPE.Payment, retry);
  const relayerFee = await this.getRelayerFee(queryApi, relayer, signer, transactionType);
  const feePaymentSignature = proxyApi.createFeePaymentSignature(relayer, signer, proxySignature, relayerFee, paymentNonce);
  return { paymentNonce, feePaymentSignature };
};

module.exports = Send;
