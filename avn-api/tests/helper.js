const AvnApi = require('../index.js')
const assert = require('chai').assert
const BN = require('bn.js')
const { accounts } = require('../config/accounts.json')
const configPath = process.argv[6] ? `../config/${process.argv[6]}.json` : '../config/sandbox.json'
const { gateway, token, avt_supply } = require(configPath)

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

async function confirmStatus(api, requestId, expectedStatus) {
  const unprocessedStates = ['Pending', 'Transaction not found']
  if (!requestId) throw new Error('RequestId cannot be null')

  for (i = 0; i < 10; i++) {
    await sleep(3000)
    const status = await api.poll.requestState(requestId)
    if (status === expectedStatus) {
      break
    }
    if (!unprocessedStates.includes(status)) {
      assert.equal(status, expectedStatus)
      break
    }
  }
}

// keep alphabetical
module.exports = {
  ACCOUNTS: accounts,
  confirmStatus,
  AVT_SUPPLY: avt_supply,
  avnApi,
  BN,
  bnEquals,
  sleep,
  token
}
