const AvnApi = require('avn-api');
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

const ONE_ETH = '1000000000000000000';
const TEN_THOUSAND_WEI = '10000';
const TEN_ETH = '10000000000000000000';
const TWO_HUNDRED_ETH = '200000000000000000000';
const WAIT_INTERVAL_IN_SECS = 1;
const MAX_WAIT_TIME_IN_MINUTES = 5;

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function avnApi(options) {
  options = options ?? {};
  const api = new AvnApi(gateway, options);

  await api.init();
  return api;
}

function bnEquals(a, b) {
  return assert.equal(new BN(a).toString(), new BN(b).toString());
}

async function confirmStatus(api, requestId, expectedStatus, optionalTimeoutInMinutes) {
  console.log(`   - max polling wait: [${optionalTimeoutInMinutes ?? MAX_WAIT_TIME_IN_MINUTES}] minutes`);
  if (!requestId) throw new Error('RequestId cannot be null');
  let response, status;

  for (i = 0; i < ((optionalTimeoutInMinutes ?? MAX_WAIT_TIME_IN_MINUTES) * 60) / WAIT_INTERVAL_IN_SECS; i++) {
    await sleep(WAIT_INTERVAL_IN_SECS * 1000);
    response = await api.poll.requestState(requestId);
    status = response.status;
    // TODO: Remove " && status !== undefined" once dev env is reset
    if (status !== 'Pending' && status !== 'AwaitingToSend' && status !== 'Transaction not found' && status !== undefined) {
      assert.equal(status, expectedStatus);
      console.log('   - Finished in ', i * WAIT_INTERVAL_IN_SECS, ' sec');
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
  GATEWAY: gateway,
  ONE_ETH,
  TEN_ETH,
  TEN_THOUSAND_WEI,
  TWO_HUNDRED_ETH,
  confirmStatus,
  avnApi,
  BN,
  bnEquals,
  randomEthTxHash,
  sleep,
  token
};
