'use strict'
const mongoClient = require("mongodb").MongoClient,
const config = require('multiconfig').load()
const log = require('log4js').getLogger()

const FEES_COLLECTION_NAME = 'fees'

const TransactionType = {
  ProxyAvtTransfer: 'proxyAvtTransfer',
  ProxyTokenTransfer: 'proxyTokenTransfer'
}

let db;


async function connect() {
  let mongoUri = `mongodb://${config.mongo.username}:${config.mongo.password}@${config.mongo.server}`;

  if (mongoUri.includes('?') == false && mongoUri.endsWith('/') == false) {
    mongoUri = `${mongoUri}/${this.config.mongo.database}`;
  }

  let options = Object.fromEntries(this.config.mongo.options.split("&").map(item => item.split("=")));
  // make numbers look like numbers (without quotes)
  for (const key of Object.keys(options)) {
      if (!isNaN(parseFloat(options[key]))) {
          options[key] = _.toNumber(options[key]);
      } else if (options[key] === "true") {
          options[key] = true;
      } else if (options[key] === "false") {
          options[key] = false;
      }
  }

  // mask user credentials
  log.info("Connecting to DocumentDB: %s. Options: %s.", mongoUri.replace(/(\/\/).+?(@)/g, '$1***:***$2'), JSON.stringify(options));

  if(options.sslValidate == true) {
    //Specify the Amazon DocumentDB cert
    const ca = [fs.readFileSync(path.resolve(__dirname, "../res/rds-combined-ca-bundle.pem"))];
    options.sslCA = ca;
  }

  let client = await mongoClient.connect(mongoUri, options);

  //Set the global variable
  db = client.db(this.config.mongo.database);
  log.info("Connected to DocumentDB");

  await  createCollections(db);
}

async function createCollections(db) {
  log.info(`Creating db collections`);
  await createFeesCollectionIfRequired(db)
}

async function createFeesCollectionIfRequired(db) {
  let collectionExists = await collectionExists(db, FEES_COLLECTION_NAME)

  if (!collectionExists) {
    log.trace(`  - Creating ${FEES_COLLECTION_NAME} db collection`);
    const collection = db.createCollection(FEES_COLLECTION_NAME);
    log.trace(` - Creating unique indexes`);
    await collection.createIndex({"relayer": 1, "transactionType": 1, "sender": 1}, { unique: true });
  }
}

async function collectionExists(db, collectionName) {
  return (await db.listCollections().toArray()).some((col) => col.name.toLowerCase() === collectionName.toLowerCase());
}

async function getFees(relayerAddress, transactionType, senderAddress) {
  // Implement me
  return {}
}

module.exports = {
  connect,
  getFees
}
