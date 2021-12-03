const AvnApi = require('../index.js')
const assert = require('chai').assert
const BN = require('bn.js')
const TOKEN = '0x81f8e50c0d69aaf39925aff8c975f77e7444c8f2'
const AVT_SUPPLY = '5100000000000000000000'
const GATEWAY_FEE_IN_AVT = '1000000000000000'
const { gateway, accounts } = require('../config/avn.json')

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
  AVT_SUPPLY,
  avnApi,
  BN,
  bnEquals,
  GATEWAY_FEE_IN_AVT,
  sleep,
  TOKEN
}
