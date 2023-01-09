const AvnApi = require('../index.js');
const assert = require('chai').assert;
const BN = require('bn.js');
const yargs = require('yargs');
const fs = require('fs');
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
const configPath = argv.environment ? argv.environment : `../config/environments/${gatewayFile}.json`;
const accountsPath = argv.accounts ? argv.accounts : `../config/accounts/${gatewayFile}.json`;

const { gateway, token, nfts } = require(configPath);
const { accounts } = require(accountsPath);
console.log(`*** Test Configuration: ***\nGateway: ${gateway} - ERC20 Token: ${token}`);

const ONE_ETH= '1000000000000000000';
const TEN_ETH = '10000000000000000000';
const TWO_HUNDRED_ETH = '200000000000000000000';
const WAIT_TIME_IN_SEC = 3;

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function avnApi(options) {
  const api = new AvnApi(gateway, options);

  await api.init();
  return api;
}

function bnEquals(a, b) {
  return assert.equal(new BN(a).toString(), new BN(b).toString());
}

async function confirmStatus(api, requestId, expectedStatus, optionalTimeoutInMinutes) {
  console.log(`waiting for [${optionalTimeoutInMinutes}] minutes`);
  if (!requestId) throw new Error('RequestId cannot be null');
  let response, status;

  for (i = 0; i < (optionalTimeoutInMinutes || 1) * 60 / WAIT_TIME_IN_SEC; i++) {
    await sleep(WAIT_TIME_IN_SEC * 1000);
    console.log('.');
    response = await api.poll.requestState(requestId);
    status = response.status;
    if (status !== 'Pending' && status !== 'Transaction not found') {
      assert.equal(status, expectedStatus);
      console.log('Wait time in seconds', i * WAIT_TIME_IN_SEC);
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