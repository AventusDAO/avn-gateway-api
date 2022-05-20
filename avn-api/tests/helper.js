const AvnApi = require('../index.js');
const assert = require('chai').assert;
const BN = require('bn.js');
const yargs = require('yargs');
const { randomAsHex } = require('@polkadot/util-crypto');

let argv = yargs
  .usage('Run smoke tests using a given Gateway environment')
  .help('h')
  .alias('h', 'help')
  .demandOption('c')
  .describe('c', 'Configuration file with gateway parameters')
  .string('c')
  .alias('c', 'gateway').argv;
// For some reason, an alias 'g' will prevent some tests from running when we call with
// npm run solo ./avn-api/tests/awtTest.js -- -g cba
// even though the full option would work fine:
// npm run solo ./avn-api/tests/awtTest.js -- --gateway cba
// This problem does not exist with other aliases, like 'c' or 'k'

let gatewayFile = argv.gateway;
const configPath = gatewayFile ? `../config/environments/${gatewayFile}.json` : '../config/environments/sandbox.json';
const accountsPath = gatewayFile ? `../config/accounts/${gatewayFile}.json` : '../config/accounts/sandbox.json';

const { gateway, token, nfts } = require(configPath);
const { accounts } = require(accountsPath);
console.log(`*** Test Configuration: ***\nGateway: ${gateway} - ERC20 Token: ${token}`);

const ONE_ETH= '1000000000000000000';
const TEN_ETH = '10000000000000000000';
const TWO_HUNDRED_ETH = '200000000000000000000';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function avnApi() {
  const api = new AvnApi(gateway);
  await api.init();
  return api;
}

function bnEquals(a, b) {
  return assert.equal(new BN(a).toString(), new BN(b).toString());
}

async function confirmStatus(api, requestId, expectedStatus) {
  if (!requestId) throw new Error('RequestId cannot be null');
  let response, status;

  for (i = 0; i < 20; i++) {
    await sleep(3000);
    response = await api.poll.requestState(requestId);
    status = response.status;
    if (status !== 'Pending' && status !== 'Transaction not found') {
      assert.equal(status, expectedStatus);
      return response;
    }
  }

  assert.equal(status, expectedStatus);
}

function randomEthTxHash() {
  return randomAsHex();
}

// keep alphabetical
module.exports = {
  ACCOUNTS: accounts,
  NFTS: nfts,
  ONE_ETH,
  TEN_ETH,
  TWO_HUNDRED_ETH,
  confirmStatus,
  avnApi,
  BN,
  bnEquals,
  randomEthTxHash,
  sleep,
  token
};
