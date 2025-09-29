const { AvnApi } = require('avn-api');
const assert = require('chai').assert;
const BN = require('bn.js');
const yargs = require('yargs');
const fs = require('fs');
const { randomAsHex, decodeAddress, encodeAddress } = require('@polkadot/util-crypto');
const { Keyring } = require('@polkadot/keyring');
const keyring = new Keyring({ type: 'sr25519', ss58Format: 42 });
const path = require('path');

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

const testConfig = argv.tests_config
  ? getTmpFileContents(argv.tests_config)
  : {
      ...require(path.resolve(__dirname, `../config/environments/${gatewayFile}.json`)),
      accounts: require(path.resolve(__dirname, `../config/accounts/${gatewayFile}.json`))?.accounts || {}
    };

function getTmpFileContents(tmpFilePath) {
  let data;
  if (fs.existsSync(tmpFilePath)) {
      data = JSON.parse(fs.readFileSync(tmpFilePath, 'utf8'));
  }
  if (data === undefined) throw Error("Config file is undefined")
  return data;
}

const { gateway, token, nfts, accounts, avt, pmToken, splitFeeConfig } = testConfig || {};
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

async function confirmStatus(pollApi, requestId, expectedStatus, optionalTimeoutInMinutes) {
  console.log(`   - max polling wait: [${optionalTimeoutInMinutes ?? MAX_WAIT_TIME_IN_MINUTES}] minutes`);
  if (!requestId) throw new Error('RequestId cannot be null');
  let response, status;

  for (i = 0; i < ((optionalTimeoutInMinutes ?? MAX_WAIT_TIME_IN_MINUTES) * 60) / WAIT_INTERVAL_IN_SECS; i++) {
    await sleep(WAIT_INTERVAL_IN_SECS * 1000);
    response = await pollApi.requestState(requestId);
    status = response.status;
    // TODO: Remove " && status !== undefined" once dev env is reset
    if (!['Pending', 'AwaitingToSend', 'Validating', 'Transaction not found', undefined].includes(status)) {
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

async function remoteSigner(data, signerAddress, totalAccounts) {
  totalAccounts = totalAccounts || accounts;
  const signerSuri = Object.keys(totalAccounts).flatMap(a =>
    totalAccounts[a].address === signerAddress ? [totalAccounts[a].seed] : []
  )[0];
  const signer = keyring.addFromUri(signerSuri);
  return signer.sign(data);
}

function ignoreAddressPrefix(input) {
  const decoded = decodeAddress(input);
  return encodeAddress(decoded, 0);
}

function convertToBaseUnits(xAvt) {
  if (argv.gateway === 'dev' || argv.gateway === 'public_testnet' || argv.gateway === 'vow') {
    return new BN(xAvt.toString()).mul(new BN('1000000000000000000'));
  } else {
    return new BN(xAvt.toString()).mul(new BN('10000000000'));
  }
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
  avnApi,
  avt,
  BN,
  bnEquals,
  confirmStatus,
  convertToBaseUnits,
  ignoreAddressPrefix,
  randomEthTxHash,
  sleep,
  token,
  pmToken,
  splitFeeConfig,
  remoteSigner
};
