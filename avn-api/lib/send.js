'use strict'

const common = require('./common.js')
const proxyApi = require('./proxy.js')

const MAX_TX_PROCESSING_TIME = 3000
const NONCE_TYPE = { proxy: 0, payment: 1 }

function Send(api, queryApi, avtContractAddress, gatewayUsageFee) {
  this.transferAvt = generateFunction(transferAvt, api, queryApi)
  this.transferToken = generateFunction(transferToken, api, queryApi)
  this.nonceMap = {}
  this.avtContractAddress = avtContractAddress
  this.gatewayUsageFee = gatewayUsageFee
}

function transferAvt(api, queryApi) {
  return async function(relayer, from, to, amount) {
    return await this.proxyTokenTransfer(api, queryApi, relayer, from, to, this.avtContractAddress, amount)
  }
}

function transferToken(api, queryApi) {
  return async function(relayer, from, to, token, amount) {
    return await this.proxyTokenTransfer(api, queryApi, relayer, from, to, token, amount)
  }
}

Send.prototype.proxyTokenTransfer = async function(api, queryApi, relayer, from, to, token, amount) {
  const nonce = await this.smartNonce(queryApi, from, NONCE_TYPE.proxy)
  const signature = proxyApi.transferToken.createAuthorisationSignature(relayer, from, to, token, amount, nonce)
  const proxyProof = {
    signer: from,
    relayer: relayer,
    signature: {
      Sr25519: signature
    }
  }
  const paymentNonce = await this.smartNonce(queryApi, from, NONCE_TYPE.payment)
  const gatewayFeeSignature = proxyApi.generatePaymentAuthorisationSignature(
    relayer,
    this.gatewayUsageFee,
    proxyProof,
    paymentNonce
  )

  return await this.postRequest(api, 'proxy', {
    pallet: 'tokenManager',
    method: 'signedTransfer',
    signature,
    relayer,
    innerArgs: { from, to, token, amount },
    gatewayFeeSignature,
    paymentNonce
  })
}

Send.prototype.postRequest = async function(api, method, params) {
  const endpoint = api.gateway + '/send'
  const response = await api.axios().post(endpoint, { jsonrpc: '2.0', id: api.uuid(), method: method, params: params })
  return response.data.result || response.data.error.message
}

function generateFunction(functionName, api, queryApi) {
  return functionName(api, queryApi)
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
