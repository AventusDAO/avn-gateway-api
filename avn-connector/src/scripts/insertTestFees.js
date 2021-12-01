'use strict'
const gatewayDb = require('../gatewayDb')

const TEST_DEFAULT_RELAYER_FEE = '7000000000000000' // 0.007 AVT
const TEST_USER1_RELAYER_FEE = '20000000000000000' // 0.02 AVT
const TEST_USER2_RELAYER_FEE = '30000000000000000' // 0.03 AVT

const DEFAULT_RELAYER_ADDRESS = '5FkmpSggqkxbeebkjdX8rU9mtSqwaw4EncypuXNZXtd1Rw1b'
const USER1_ADDRESS = '5FgyNN84CzQfwHBUJWvQkr36hiQYEXjDhcUYVx9tCTdgqosF'
const USER2_ADDRESS = '5DAgxVxKmnJ7hfhDEB9UetZm4jR2MPjGZGrmJZjirSVJDdMr'

const testRelayerFees = { "relayer": DEFAULT_RELAYER_ADDRESS, fees: {} }
const testUser1Fees = { "relayer": DEFAULT_RELAYER_ADDRESS, "user": USER1_ADDRESS, fees: {} }
const testUser2Fees = { "relayer": DEFAULT_RELAYER_ADDRESS, "user": USER2_ADDRESS, fees: {} }

async function run() {
  try {
    await gatewayDb.init()

    console.log(`Connecting to mongo`)
    const db = await gatewayDb.connect()
    const feesCollection = await db.collection(gatewayDb.FEES_COLLECTION_NAME)
    const userFeesCollection = await db.collection(gatewayDb.USER_FEES_COLLECTION_NAME)

    if (await feesCollection.findOne({relayer: DEFAULT_RELAYER_ADDRESS})) {
      console.log(`\n\tIt looks like this script has already been run on this database, exiting now.\n`)
      return
    }

    populateTestFees()

    console.log(`Inserting fees`)
    await feesCollection.insertOne(testRelayerFees)
    await userFeesCollection.insertOne(testUser1Fees)
    await userFeesCollection.insertOne(testUser2Fees)

    console.log(`Fees inserted successfully`)
  } catch (err) {
    console.log(`Error running script: ${err}`)
  } finally {
    await gatewayDb.databaseClient().close()
  }
}

function populateTestFees() {
  testRelayerFees.fees[gatewayDb.TransactionType.ProxyAvtTransfer] = TEST_DEFAULT_RELAYER_FEE
  testRelayerFees.fees[gatewayDb.TransactionType.ProxyTokenTransfer] = TEST_DEFAULT_RELAYER_FEE
  testRelayerFees.fees[gatewayDb.TransactionType.ProxyMintSingleNft] = TEST_DEFAULT_RELAYER_FEE

  testUser1Fees.fees[gatewayDb.TransactionType.ProxyAvtTransfer] = TEST_USER1_RELAYER_FEE

  testUser2Fees.fees[gatewayDb.TransactionType.ProxyTokenTransfer] = TEST_USER2_RELAYER_FEE
}

(async () => {
  await run()
})()