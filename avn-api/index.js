const { cryptoWaitReady } = require('@polkadot/util-crypto')
const { v4: uuidv4 } = require('uuid')
const Axios = require('axios')
const Query = require('./lib/query.js')
const Send = require('./lib/send.js')
const Poll = require('./lib/poll.js')
const Awt = require('./lib/awt.js')
const version = require('./package.json').version

// TODO - Remove this and replace with getter before releasing to public github / NPM
const GATEWAY_FEE_IN_AVT = '1000000000000000' // 0.001 AVT

function AvnApi(gateway) {
  this.gateway = gateway
  this.version = version
  this.awtToken
}

AvnApi.prototype.init = async function() {
  await cryptoWaitReady()

  awtToken = Awt.generateAwtToken(process.env.SURI)
  const avnApi = {
    gateway: this.gateway,
    gatewayFee: GATEWAY_FEE_IN_AVT,
    uuid: () => uuidv4(),
    axios: () => setupAxios(Awt)
  }

  this.query = new Query(avnApi)
  const avtContractAddress = await this.query.getAvtContractAddress(avnApi)
  this.send = new Send(avnApi, this.query, avtContractAddress)
  this.poll = new Poll(avnApi)
  this.awt = Awt
}

function setupAxios(awtTokenManager) {
  if (!awtTokenManager.tokenAgeIsValid(this.awtToken)) {
    console.log(' - Awt token has expired, refreshing')
    this.awtToken = awtTokenManager.generateAwtToken(process.env.SURI)
  }

  // Add any middlewares here to configure global axios behaviours
  Axios.defaults.headers.common = { Authorization: `bearer ${this.awtToken}` }
  return Axios
}

module.exports = AvnApi
