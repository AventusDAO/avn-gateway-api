const AvnApi = require('../index.js')
const assert = require('chai').assert
const BN = require('bn.js')
const { accounts } = require('../config/accounts.json')
const configPath = process.argv[6] ? `../config/${process.argv[6]}.json` : '../config/sandbox.json'
const { gateway, token } = require(configPath)

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
  avnApi,
  BN,
  bnEquals,
  sleep,
  token
}
