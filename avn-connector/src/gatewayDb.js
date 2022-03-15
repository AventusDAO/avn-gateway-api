'use strict';
const mongoClient = require('mongodb').MongoClient;
const config = require('multiconfig').load();
const log = require('log4js').getLogger();
const fs = require('fs');
const path = require('path');

const FEES_COLLECTION_NAME = 'fees';
const USER_FEES_COLLECTION_NAME = 'userFees';
const DEFAULT_RELAYER_FEE = '1000000000000000'; //0.001 AVT

const TransactionType = {
  ProxyAvtTransfer: 'proxyAvtTransfer',
  ProxyTokenTransfer: 'proxyTokenTransfer',
  ProxyTokenLower: 'proxyTokenLower',
  ProxyMintSingleNft: 'proxyMintSingleNft',
  ProxyListNftOpenForSale: 'proxyListNftOpenForSale',
  ProxyTransferFiatNft: 'proxyTransferFiatNft',
  ProxyCancelListFiatNft: 'proxyCancelListFiatNft',
  ProxyBond: 'proxyBond',
  ProxyNominate: 'proxyNominate',
  ProxyIncreaseStake: 'proxyIncreaseStake',
  ProxyUnstake: 'proxyUnstake',
  ProxyWithdrawUnlocked: 'proxyWithdrawUnlocked',
  ProxyPayoutStakers: 'proxyPayoutStakers'
};

const defaultFees = {};
let db, client;

async function connect() {
  let mongoUri = `mongodb://${config.mongo.username}:${config.mongo.password}@${config.mongo.server}`;

  if (mongoUri.includes('?') == false && mongoUri.endsWith('/') == false) {
    mongoUri = `${mongoUri}/${config.mongo.database}`;
  }

  let options = Object.fromEntries(config.mongo.options.split('&').map(item => item.split('=')));
  // make numbers look like numbers (without quotes)
  for (const key of Object.keys(options)) {
    //TODO: extract this check into a utility function (maybe call it `isNumber`)
    if (!isNaN(parseInt(options[key]))) {
      options[key] = parseInt(options[key]);
    } else if (options[key] === 'true') {
      options[key] = true;
    } else if (options[key] === 'false') {
      options[key] = false;
    }
  }

  // mask user credentials
  log.info(
    'Connecting to DocumentDB: %s. Options: %s.',
    mongoUri.replace(/(\/\/).+?(@)/g, '$1***:***$2'),
    JSON.stringify(options)
  );

  if (options.sslValidate == true) {
    //Specify the Amazon DocumentDB cert
    const ca = [fs.readFileSync(path.resolve(__dirname, './res/rds-combined-ca-bundle.pem'))];
    options.sslCA = ca;
  }

  client = await mongoClient.connect(mongoUri, options);

  //Set the global variable
  db = client.db(config.mongo.database);
  log.info('Connected to DocumentDB');

  return db;
}

async function init() {
  // Connect to documentDB
  await connect();

  // Do other initialisations
  await createCollections(db);
  setupDefaultFees();
}

function setupDefaultFees() {
  defaultFees[TransactionType.ProxyAvtTransfer] = DEFAULT_RELAYER_FEE;
  defaultFees[TransactionType.ProxyTokenTransfer] = DEFAULT_RELAYER_FEE;
  defaultFees[TransactionType.ProxyTokenLower] = DEFAULT_RELAYER_FEE;
  defaultFees[TransactionType.ProxyMintSingleNft] = DEFAULT_RELAYER_FEE;
  defaultFees[TransactionType.ProxyListNftOpenForSale] = DEFAULT_RELAYER_FEE;
  defaultFees[TransactionType.ProxyTransferFiatNft] = DEFAULT_RELAYER_FEE;
  defaultFees[TransactionType.ProxyCancelListFiatNft] = DEFAULT_RELAYER_FEE;
  defaultFees[TransactionType.ProxyBond] = DEFAULT_RELAYER_FEE;
  defaultFees[TransactionType.ProxyNominate] = DEFAULT_RELAYER_FEE;
  defaultFees[TransactionType.ProxyIncreaseStake] = DEFAULT_RELAYER_FEE;
  defaultFees[TransactionType.ProxyUnstake] = DEFAULT_RELAYER_FEE;
  defaultFees[TransactionType.ProxyWithdrawUnlocked] = DEFAULT_RELAYER_FEE;
  defaultFees[TransactionType.ProxyPayoutStakers] = DEFAULT_RELAYER_FEE;
}

async function createCollections(db) {
  log.info(`Creating db collections`);
  await createFeesCollectionIfRequired(db);
  await createUserFeesCollectionIfRequired(db);
}

async function createFeesCollectionIfRequired(db) {
  let exists = await collectionExists(db, FEES_COLLECTION_NAME);

  if (!exists) {
    log.trace(`  - Creating ${FEES_COLLECTION_NAME} db collection`);
    const collection = await db.createCollection(FEES_COLLECTION_NAME);
    log.trace(`  - Creating unique indexes`);
    await collection.createIndex({ relayer: 1 }, { unique: true });
  }
}

async function createUserFeesCollectionIfRequired(db) {
  let exists = await collectionExists(db, USER_FEES_COLLECTION_NAME);

  if (!exists) {
    log.trace(`  - Creating ${USER_FEES_COLLECTION_NAME} db collection`);
    const collection = await db.createCollection(USER_FEES_COLLECTION_NAME);
    log.trace(`  - Creating unique indexes`);
    await collection.createIndex({ relayer: 1, user: 1 }, { unique: true });
  }
}

async function collectionExists(db, collectionName) {
  return (await db.listCollections().toArray()).some(col => col.name.toLowerCase() === collectionName.toLowerCase());
}

// userAddress and transactionType are optional
async function getFees(relayerAddress, userAddress, transactionType) {
  if (transactionType && !Object.values(TransactionType).includes(transactionType)) {
    throw new Error(`Invalid transaction type ${transactionType} found. Allowed values are ${Object.values(TransactionType)}`);
  }

  const relayerFees = await getRelayerFees(relayerAddress);
  const userFees = await getUserFeesIfAny(relayerAddress, userAddress);

  const fees = { ...defaultFees, ...relayerFees, ...userFees };

  return transactionType ? fees[transactionType] : fees;
}

async function getRelayerFees(relayerAddress) {
  if (!relayerAddress) {
    throw new Error(`Relayer address is a mandatory field`);
  }

  const relayerFeesCursor = await db.collection(FEES_COLLECTION_NAME).find({ relayer: relayerAddress }).limit(1);

  if (await relayerFeesCursor.hasNext()) {
    return (await relayerFeesCursor.next()).fees;
  }

  throw new Error(`Relayer ${relayerAddress} is not registered with AvN Gateway`);
}

async function getUserFeesIfAny(relayerAddress, userAddress) {
  if (!relayerAddress || !userAddress) {
    log.trace({
      message: 'Relayer address or User address is missing.',
      RelayerAddress: relayerAddress,
      UserAddress: userAddress
    });
    return undefined;
  }

  const userFeesCursor = await db
    .collection(USER_FEES_COLLECTION_NAME)
    .find({ relayer: relayerAddress, user: userAddress })
    .limit(1);

  if (await userFeesCursor.hasNext()) {
    return (await userFeesCursor.next()).fees;
  }

  return undefined;
}

module.exports = {
  connect,
  getFees,
  init,
  databaseClient: () => client,
  TransactionType,
  FEES_COLLECTION_NAME,
  USER_FEES_COLLECTION_NAME
};
