const AvnApi = require('../index.js')
const assert = require('chai').assert
const BN = require('bn.js')
const { accounts } = require('../config/accounts.json')

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function avnApi() {
  ;({ gateway } = require(`../config/${process.argv[6]}.json`))
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
  sleep
}
