const AvnApi = require('../index.js')
const assert = require('chai').assert
const BN = require('bn.js')
const { gateway, accounts, token, avt_supply, gateway_fee_in_avt } = require('../config/avn.json')

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function avnApi() {
  const api = new AvnApi(gateway)
  await api.init()
  return api
}

function bnEquals(a, b) {
  return assert.equal(new BN(a).toString(), new BN(b).toString())
}

// keep alphabetical
module.exports = {
  ACCOUNTS: accounts,
  AVT_SUPPLY: avt_supply,
  avnApi,
  BN,
  bnEquals,
  GATEWAY_FEE_IN_AVT: gateway_fee_in_avt,
  sleep,
  TOKEN: token
}
