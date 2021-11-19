'use strict'

const common = require('./common.js')
const proxyApi = require('./proxy.js')

const MAX_TX_PROCESSING_TIME = 3000
const NONCE_TYPE = { proxy: 0, payment: 1 }

function Send(api, queryApi, avtContractAddress, gatewayFee) {
  this.transferAvt = generateFunction(transferAvt, api, queryApi)
  this.transferToken = generateFunction(transferToken, api, queryApi)
  this.nonceMap = {}
  this.avtContractAddress = avtContractAddress
  this.gatewayFee = gatewayFee
}

function transferAvt(api, queryApi) {
  return async function(relayer, signer, recipient, amount) {
    return await this.proxyTokenTransfer(api, queryApi, relayer, signer, recipient, this.avtContractAddress, amount)
  }
}

function transferToken(api, queryApi) {
  return async function(relayer, signer, recipient, token, amount) {
    return await this.proxyTokenTransfer(api, queryApi, relayer, signer, recipient, token, amount)
  }
}

Send.prototype.proxyTokenTransfer = async function(api, queryApi, relayer, signer, recipient, token, amount) {
  const nonce = await this.smartNonce(queryApi, signer, NONCE_TYPE.proxy)
  const proxyTokenTransferSignature = proxyApi.createProxyTokenTransferSignature(
    relayer,
    signer,
    recipient,
    token,
    amount,
    nonce
  )

  const paymentNonce = await this.smartNonce(queryApi, signer, NONCE_TYPE.payment)
  const feePaymentSignature = proxyApi.createFeePaymentSignature(
    relayer,
    signer,
    proxyTokenTransferSignature,
    api.gatewayFee,
    paymentNonce
  )

  return await this.postRequest(api, 'proxy', {
    pallet: 'tokenManager',
    method: 'signedTransfer',
    relayer,
    signer,
    recipient,
    token,
    amount,
    proxyTokenTransferSignature,
    feePaymentSignature,
    paymentNonce
  })
}

function generateFunction(functionName, api, queryApi) {
  return functionName(api, queryApi)
}

Send.prototype.postRequest = async function(api, method, params) {
  const endpoint = api.gateway + '/send'
  const response = await api.axios().post(endpoint, { jsonrpc: '2.0', id: api.uuid(), method: method, params: params })
  return response.data.result || response.data.error.message
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

module.exports = Send
