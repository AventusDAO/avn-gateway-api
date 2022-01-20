'use strict';
const gatewayDb = require('../gatewayDb');
const config = require('multiconfig').load();

const TESTNET = 'testnet';
const MAINNET = 'mainnet';
const DEFAULT_RELAYER_FEE = config.relayer.fee;
const TEST_USER1_RELAYER_FEE = '20000000000000000';
const TEST_USER2_RELAYER_FEE = '30000000000000000';

const RELAYER_ADDRESS = config.relayer.address;
const USER1_ADDRESS = '5FgyNN84CzQfwHBUJWvQkr36hiQYEXjDhcUYVx9tCTdgqosF';
const USER2_ADDRESS = '5DAgxVxKmnJ7hfhDEB9UetZm4jR2MPjGZGrmJZjirSVJDdMr';

const testRelayerFees = { relayer: RELAYER_ADDRESS, fees: {} };
const testUser1Fees = { relayer: RELAYER_ADDRESS, user: USER1_ADDRESS, fees: {} };
const testUser2Fees = { relayer: RELAYER_ADDRESS, user: USER2_ADDRESS, fees: {} };

async function run() {
  try {
    await gatewayDb.init();

    console.log(`Connecting to mongo`);
    const db = await gatewayDb.connect();
    const feesCollection = await db.collection(gatewayDb.FEES_COLLECTION_NAME);
    const userFeesCollection = await db.collection(gatewayDb.USER_FEES_COLLECTION_NAME);

    console.log(`Checking relayer address: ${RELAYER_ADDRESS}`);
    if (await feesCollection.findOne({ relayer: RELAYER_ADDRESS })) {
      console.log(`\n\tIt looks like this script has already been run on this database, exiting now.\n`);
      return;
    }

    populateTestFees();

    console.log(`Inserting fees for Relayer: ${RELAYER_ADDRESS}`);
    await feesCollection.insertOne(testRelayerFees);
    if (process.env.ENVIRONMENT !== TESTNET && process.env.ENVIRONMENT !== MAINNET) {
      console.log('Inserting test user data');
      await userFeesCollection.insertOne(testUser1Fees);
      await userFeesCollection.insertOne(testUser2Fees);
    }

    console.log(`Fees inserted successfully`);
  } catch (err) {
    console.log(`Error running script: ${err}`);
  } finally {
    await gatewayDb.databaseClient().close();
    process.exit(0);
  }
}

function populateTestFees() {
  testRelayerFees.fees[gatewayDb.TransactionType.ProxyAvtTransfer] = DEFAULT_RELAYER_FEE;
  testRelayerFees.fees[gatewayDb.TransactionType.ProxyTokenTransfer] = DEFAULT_RELAYER_FEE;
  testRelayerFees.fees[gatewayDb.TransactionType.ProxyMintSingleNft] = DEFAULT_RELAYER_FEE;
  testRelayerFees.fees[gatewayDb.TransactionType.ProxyListNftOpenForSale] = DEFAULT_RELAYER_FEE;
  testRelayerFees.fees[gatewayDb.TransactionType.ProxyTransferFiatNft] = DEFAULT_RELAYER_FEE;
  testRelayerFees.fees[gatewayDb.TransactionType.ProxyCancelListFiatNft] = DEFAULT_RELAYER_FEE;

  testUser1Fees.fees[gatewayDb.TransactionType.ProxyAvtTransfer] = TEST_USER1_RELAYER_FEE;

  testUser2Fees.fees[gatewayDb.TransactionType.ProxyTokenTransfer] = TEST_USER2_RELAYER_FEE;
}

(async () => await run())();
