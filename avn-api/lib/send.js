'use strict'

const common = require('./common.js')
const proxyApi = require('./proxy.js')

const MAX_TX_PROCESSING_TIME = 3000
const NONCE_TYPE = { proxy: 0, payment: 1 }
const TX_TYPE = common.TX_TYPE

function Send(api, queryApi, avtContractAddress) {
  this.transferAvt = generateFunction(transferAvt, api, queryApi)
  this.transferToken = generateFunction(transferToken, api, queryApi)
  this.mintSingleNft = generateFunction(mintSingleNft, api, queryApi)
  this.listNftOpenForSale = generateFunction(listNftOpenForSale, api, queryApi)
  this.transferFiatNft = generateFunction(transferFiatNft, api, queryApi)
  this.avtContractAddress = avtContractAddress
  this.nonceMap = {}
  this.feesMap = {}
}

function transferAvt(api, queryApi) {
  return async function(relayer, signer, recipient, amount) {
    common.validateAccount(relayer)
    common.validateAccount(signer)
    common.validateAccount(recipient)
    common.validateAmount(amount)

    return await this.proxyTransfer(api, queryApi, relayer, signer, recipient, this.avtContractAddress, amount)
  }
}

function transferToken(api, queryApi) {
  return async function(relayer, signer, recipient, token, amount) {
    common.validateAccount(relayer)
    common.validateAccount(signer)
    common.validateAccount(recipient)
    common.validateEthereumAddress(token)
    common.validateAmount(amount)

    return await this.proxyTransfer(api, queryApi, relayer, signer, recipient, token, amount)
  }
}

function listNftOpenForSale(api, queryApi) {
  return async function(relayer, signer, nftId, _market) {
    common.validateAccount(relayer)
    common.validateAccount(signer)
    common.validateNftId(nftId)
    const market = common.validateMarketAndReturnEnum(_market)

    const nftNonce = await queryApi.getNftNonce(nftId)

    const proxyListNftOpenForSaleSignature = proxyApi.createProxyListNftOpenForSaleSignature(
      relayer,
      signer,
      nftId,
      market,
      nftNonce
    )

    const paymentNonce = await this.smartNonce(queryApi, signer, NONCE_TYPE.payment)
    const transactionType = TX_TYPE.ProxyListNftOpenForSale
    const relayerFee = await this.getRelayerFee(queryApi, relayer, signer, transactionType)
    const feePaymentSignature = proxyApi.createFeePaymentSignature(
      relayer,
      signer,
      proxyListNftOpenForSaleSignature,
      relayerFee,
      paymentNonce
    )

    const response = await this.postRequest(api, transactionType, {
      pallet: 'nftManager',
      method: 'signedListNftOpenForSale',
      relayer,
      signer,
      nftId,
      market,
      proxyListNftOpenForSaleSignature,
      feePaymentSignature,
      paymentNonce
    })

    if (!response && !isRetry) {
      await this.listNftOpenForSale(relayer, signer, nftId, market)
    }

    return response
  }
}

function mintSingleNft(api, queryApi) {
  return async function(relayer, signer, externalRef, royalties, t1Authority) {
    common.validateAccount(relayer)
    common.validateAccount(signer)
    common.validateStringIsPopulated(externalRef)
    common.validateIsArray(royalties)
    common.validateEthereumAddress(t1Authority)

    const proxyMintSignature = proxyApi.createProxyMintSingleNftSignature(
      relayer,
      signer,
      externalRef,
      royalties,
      t1Authority
    )
    const paymentNonce = await this.smartNonce(queryApi, signer, NONCE_TYPE.payment)
    const transactionType = TX_TYPE.ProxyMintSingleNft
    const relayerFee = await this.getRelayerFee(queryApi, relayer, signer, transactionType)
    const feePaymentSignature = proxyApi.createFeePaymentSignature(
      relayer,
      signer,
      proxyMintSignature,
      relayerFee,
      paymentNonce
    )

    const response = await this.postRequest(api, transactionType, {
      pallet: 'nftManager',
      method: 'signedMintSingleNft',
      relayer,
      signer,
      externalRef,
      royalties,
      t1Authority,
      proxyMintSignature,
      feePaymentSignature,
      paymentNonce
    })

    if (!response && !isRetry) {
      await this.mintSingleNft(relayer, signer, externalRef, royalties, t1Authority)
    }

    return response
  }
}

function transferFiatNft(api, queryApi) {
  return async function(relayer, signer, _recipient, nftId) {
    common.validateAccount(relayer)
    common.validateAccount(signer)
    const recipient = common.convertToPublicKeyIfNeeded(_recipient)
    common.validateNftId(nftId)

    const opId = await queryApi.getNftNonce(nftId)

    const proxyTransferFiatNftSignature = proxyApi.createProxyTransferFiatNftSignature(
      relayer,
      signer,
      nftId,
      recipient,
      opId
    )

    const paymentNonce = await this.smartNonce(queryApi, signer, NONCE_TYPE.payment)
    const transactionType = TX_TYPE.ProxyTransferFiatNft
    const relayerFee = await this.getRelayerFee(queryApi, relayer, signer, transactionType)
    const feePaymentSignature = proxyApi.createFeePaymentSignature(
      relayer,
      signer,
      proxyTransferFiatNftSignature,
      relayerFee,
      paymentNonce
    )

    const response = await this.postRequest(api, transactionType, {
      pallet: 'nftManager',
      method: 'signedTransferFiatNft',
      relayer,
      signer,
      nftId,
      recipient,
      proxyTransferFiatNftSignature,
      feePaymentSignature,
      paymentNonce
    })

    if (!response && !isRetry) {
      await this.transferFiatNft(relayer, signer, recipient, nftId)
    }

    return response
  }
}

Send.prototype.proxyTransfer = async function(api, queryApi, relayer, signer, recipient, token, amount, isRetry) {
  const proxyNonce = await this.smartNonce(queryApi, signer, NONCE_TYPE.proxy)
  const proxyTransferSignature = proxyApi.createProxyTransferSignature(
    relayer,
    signer,
    recipient,
    token,
    amount,
    proxyNonce
  )

  const paymentNonce = await this.smartNonce(queryApi, signer, NONCE_TYPE.payment)
  const transactionType = token === this.avtContractAddress ? TX_TYPE.ProxyAvtTransfer : TX_TYPE.ProxyTokenTransfer
  const relayerFee = await this.getRelayerFee(queryApi, relayer, signer, transactionType)
  const feePaymentSignature = proxyApi.createFeePaymentSignature(
    relayer,
    signer,
    proxyTransferSignature,
    relayerFee,
    paymentNonce
  )

  const response = await this.postRequest(api, transactionType, {
    pallet: 'tokenManager',
    method: 'signedTransfer',
    relayer,
    signer,
    recipient,
    token,
    amount,
    proxyTransferSignature,
    feePaymentSignature,
    paymentNonce
  })

  if (!response && !isRetry) {
    await this.proxyTransfer(api, queryApi, relayer, signer, recipient, token, amount, true)
  }

  return response
}

function generateFunction(functionName, api, queryApi) {
  return functionName(api, queryApi)
}

Send.prototype.postRequest = async function(api, method, params) {
  const endpoint = api.gateway + '/send'
  const response = await api.axios().post(endpoint, { jsonrpc: '2.0', id: api.uuid(), method: method, params: params })

  if (!response || !response.data) {
    throw new Error('Invalid server response')
  }

  if (response.data.result) {
    return response.data.result
  }

  throw new Error(`Error processing send: ${JSON.stringify(response.data.error)}`)
}

Send.prototype.smartNonce = async function(queryApi, _account, nonceType) {
  const account = common.convertToPublicKeyIfNeeded(_account)
  if (!this.nonceMap[account]) this.nonceMap[account] = { proxy: {}, payment: {} }
  const nonceData = this.nonceMap[account]
  const updated = Date.now()
  let nonce

  switch (nonceType) {
    case NONCE_TYPE.proxy:
      nonce =
        nonceData.proxy.nonce === undefined || updated - nonceData.proxy.updated >= MAX_TX_PROCESSING_TIME * 2
          ? parseInt(await queryApi.getAccountNonce(account))
          : nonceData.proxy.nonce + 1

      this.nonceMap[account].proxy = { nonce: nonce, updated: updated }
      break

    case NONCE_TYPE.payment:
      nonce =
        nonceData.payment.nonce === undefined || updated - nonceData.payment.updated >= MAX_TX_PROCESSING_TIME * 2
          ? parseInt(await queryApi.getAccountPaymentNonce(account))
          : nonceData.payment.nonce + 1

      this.nonceMap[account].payment = { nonce: nonce, updated: updated }
      break

    default:
      throw new Error(`Invalid nonce type (${nonceType}) provided`)
  }

  return nonce.toString()
}

Send.prototype.getRelayerFee = async function(queryApi, relayer, user, transactionType) {
  if (!this.feesMap[relayer]) this.feesMap[relayer] = {}
  if (!this.feesMap[relayer][user]) this.feesMap[relayer][user] = await queryApi.getRelayerFees(relayer, user)
  return this.feesMap[relayer][user][transactionType]
}

module.exports = Send
