'use strict'

const common = require('./common.js')
const proxyApi = require('./proxy.js')

const MAX_TX_PROCESSING_TIME = 3000
const NonceType = {
  proxyNonce: 0,
  paymentNonce: 1
};

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
  const nonce = await this.smartNonce(queryApi, from, NonceType.proxyNonce)
  const signature = proxyApi.transferToken.createAuthorisationSignature(relayer, from, to, token, amount, nonce)
  const gatewayFeeSignature = await generatePaymentAuthorisationSiganture(queryApi, from, relayer, signature)

  return await this.postRequest(api, 'proxy', {
    pallet: 'tokenManager',
    method: 'signedTransfer',
    signature,
    relayer,
    innerArgs: { from, to, token, amount },
    gatewayFeeSignature
  })
}

async function generatePaymentAuthorisationSiganture(queryApi, payer, payee, signature) {
  const paymentNonce = await this.smartPaymentNonce(queryApi, payer, NonceType.paymentNonce)
  const proxyProof = {
    signer: payer,
    relayer: payee,
    signature: {
      Sr25519: signature
    }
  }
  return proxyApi.generatePaymentAuthorisationSignature(payee, this.gatewayUsageFee, proxyProof, paymentNonce)
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
  const nonceData = this.nonceMap[account]
  const updated = Date.now()

  let nonce;

  switch (nonceType) {
    case nonceType.proxyNonce:
      const proxyNonceData = nonceData ? nonceData.proxyNonce : undefined
      nonce = proxyNonceData === undefined || updated - proxyNonceData.updated >= MAX_TX_PROCESSING_TIME * 2
      ? parseInt(await queryApi.getAccountNonce(account))
      : proxyNonceData.nonce + 1

      this.nonceMap[account].proxyNonce = { nonce: nonce, updated: updated }
      break;

    case nonceType.paymentNonce:
      const paymentNonceData = nonceData ? nonceData.paymentNonce : undefined
      nonce = paymentNonceData === undefined || updated - paymentNonceData.updated >= MAX_TX_PROCESSING_TIME * 2
      ? parseInt(await queryApi.getAccountPaymentNonce(account))
      : paymentNonceData.nonce + 1

      this.nonceMap[account].paymentNonce = { nonce: nonce, updated: updated }
      break;
    default:
      throw new Error(`Invalid nonce type (${nonceType}) provided`)
  }

  return nonce.toString()
}

module.exports = Send
