'use strict'
const mongoClient = require('mongodb').MongoClient
const config = require('multiconfig').load()
const log = require('log4js').getLogger()
const fs = require('fs')
const path = require("path")

const FEES_COLLECTION_NAME = 'fees'
const DEFAULT_RELAYER_FEE = '1000000000000000' //0.001 AVT

const TransactionType = {
  ProxyAvtTransfer: 'proxyAvtTransfer',
  ProxyTokenTransfer: 'proxyTokenTransfer'
}

const defaultFees = {}
let db

async function connect() {
  let mongoUri = `mongodb://${config.mongo.username}:${config.mongo.password}@${config.mongo.server}`

  if (mongoUri.includes('?') == false && mongoUri.endsWith('/') == false) {
    mongoUri = `${mongoUri}/${config.mongo.database}`
  }

  let options = Object.fromEntries(config.mongo.options.split('&').map(item => item.split('=')))
  // make numbers look like numbers (without quotes)
  for (const key of Object.keys(options)) {
    if (!isNaN(parseFloat(options[key]))) {
      options[key] = parseInt(options[key])
    } else if (options[key] === 'true') {
      options[key] = true
    } else if (options[key] === 'false') {
      options[key] = false
    }
  }

  // mask user credentials
  log.info(
    'Connecting to DocumentDB: %s. Options: %s.',
    mongoUri.replace(/(\/\/).+?(@)/g, '$1***:***$2'),
    JSON.stringify(options)
  )

  if (options.sslValidate == true) {
    //Specify the Amazon DocumentDB cert
    const ca = [fs.readFileSync(path.resolve(__dirname, '/res/rds-combined-ca-bundle.pem'))]
    options.sslCA = ca
  }

  let client = await mongoClient.connect(mongoUri, options)

  //Set the global variable
  db = client.db(config.mongo.database)
  log.info('Connected to DocumentDB')

  // Do other initialisations
  await createCollections(db)
  setupDefaultFees()
}

function setupDefaultFees() {
  defaultFees[TransactionType.ProxyAvtTransfer] = DEFAULT_RELAYER_FEE
  defaultFees[TransactionType.ProxyTokenTransfer] = DEFAULT_RELAYER_FEE
}

async function createCollections(db) {
  log.info(`Creating db collections`)
  await createFeesCollectionIfRequired(db)
}

async function createFeesCollectionIfRequired(db) {
  let exists = await collectionExists(db, FEES_COLLECTION_NAME)

  if (!exists) {
    log.trace(`  - Creating ${FEES_COLLECTION_NAME} db collection`)
    const collection = db.createCollection(FEES_COLLECTION_NAME)
    log.trace(` - Creating unique indexes`)
    await collection.createIndex({ relayer: 1 }, { unique: true })
  }
}

async function collectionExists(db, collectionName) {
  return (await db.listCollections().toArray()).some(col => col.name.toLowerCase() === collectionName.toLowerCase())
}

// transactionType and senderAddress are optional
async function getFees(relayerAddress, userAddress, transactionType) {
  if (!relayerAddress) {
    throw new Error(`Relayer address is a mandatory field`)
  }

  // const feesCursor = await db.collection(FEES_COLLECTION_NAME).find({ "relayer": relayerAddress }).limit(1);

  // if (await feesCursor.hasNext()) {
  //   const fees =  await feesCursor.next();
  //   // Apply additional filtering based on transactionType and senderAddress

  //   return
  // }

  // return undefined;

  return defaultFees
}

module.exports = {
  connect,
  getFees,
  TransactionType
}
