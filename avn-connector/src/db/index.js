const config = require('multiconfig').load();
const typeorm = require('typeorm');
const { IsNull } = require('typeorm');
const { isHex, u8aToHex } = require('@polkadot/util');
const { decodeAddress, encodeAddress } = require('@polkadot/util-crypto');

const SPLIT_FEE_USER_TABLE = 'splitFeeUser';
const FEE_TABLE = 'fee';
const RELAYER_TABLE = 'relayer';
const PAYER_TRANSACTION_TABLE = 'payerTransaction';
const TRANSACTION_TABLE = 'transaction';
const WEBHOOK_ENDPOINT_TABLE = 'webhookEndpoint';
const WEBHOOK_EVENT_TABLE = 'webhookEvent';
const WEBHOOKS_TABLE = 'webhooks';

let dataSource;

async function init() {
  dataSource = new typeorm.DataSource({
    type: 'postgres',
    host: config.postgres.host,
    port: config.postgres.port,
    username: config.postgres.username,
    password: config.postgres.password,
    database: config.postgres.database,
    synchronize: config.postgres.synchronize === 'true',
    entities: [
      require('./entity/payer'),
      require('./entity/splitFeeUser'),
      require('./entity/transaction'),
      require('./entity/payerTransaction'),
      require('./entity/fee'),
      require('./entity/relayer'),
      require('./entity/webhookEndpoint'),
      require('./entity/webhookEvent'),
      require('./entity/webhooks')
    ]
  });

  await dataSource.initialize();

  return dataSource;
}

async function getPayer(user, payer) {
  const userPublicKey = getPublicKey(user);

  if (!userPublicKey && !payer) return undefined;

  const userDataSource = await dataSource.getRepository(SPLIT_FEE_USER_TABLE);

  const splitFeeUser = await userDataSource.findOne({
    where: { publicKey: userPublicKey, enabled: true },
    relations: ['payer']
  });
  if (!splitFeeUser || !splitFeeUser.payer) return undefined;

  // This check is useful when we start supporting multiple payers for the same user.
  if (payer) {
    const payerPublicKey = getPublicKey(payer);
    if (splitFeeUser.payer.publicKey !== payerPublicKey) {
      return undefined;
    }
  }

  return {
    payerId: splitFeeUser.payer.id,
    payerAddress: encodeAddress(splitFeeUser.payer.publicKey, 42),
    vaultId: splitFeeUser.payer.vaultId
  };
}

// This function will return the fee as a string
async function getFees(relayerAddress, user, transactionName) {
  let userPk;

  const relayer = await getRelayer(relayerAddress);
  if (!relayer) throw new Error(`Relayer (${relayerAddress}) cannot be found.`);
  if (!relayer.defaultFee) throw new Error(`Relayer  ${relayerAddress} does not have a default fee set`);

  const feeDataSource = await dataSource.getRepository(FEE_TABLE);

  if (user) {
    userPk = getPublicKey(user);
  }

  if (transactionName) {
    return await getSingleFee(feeDataSource, relayer, userPk, transactionName);
  }

  return await getAllFees(feeDataSource, relayer, userPk);
}

async function isPayerTransaction(payer, transactionName) {
  if (!payer || !transactionName) return false;
  const payerPk = getPublicKey(payer);

  const payerTransactionDataSource = await dataSource.getRepository(PAYER_TRANSACTION_TABLE);

  let payerTx = await payerTransactionDataSource.findOne({
    where: {
      payer: { publicKey: payerPk, enabled: true },
      transaction: { name: transactionName, enabled: true },
      enabled: true
    },
    relations: ['payer', 'transaction']
  });

  return payerTx ? true : false;
}

async function getRelayer(relayerAddress) {
  if (!relayerAddress) return undefined;

  const relayerPk = getPublicKey(relayerAddress);
  const relayerDataSource = await dataSource.getRepository(RELAYER_TABLE);
  return await relayerDataSource.findOne({ where: { publicKey: relayerPk, enabled: true } });
}

// This function expects that each relayer has at least one default fee or a fee for each transaction type.
function buildFeesJson(dbResult, relayerDefaultFee, transactionTypes) {
  let defaultFee;
  let relayerFees = {};

  (dbResult || []).forEach(r => {
    const hasTransactionFee = !!r.transaction && !!r.transaction.name;
    if (hasTransactionFee) {
      // Prioritise user specific fees over default fees for transaction
      if (!relayerFees[r.transaction.name] || r.userPublicKey) {
        relayerFees[r.transaction.name] = r.fee;
      }
    } else if (r.userPublicKey) {
      // This is the default fee for the user
      defaultFee = r.fee;
    }
  });

  defaultFee = defaultFee ?? relayerDefaultFee;
  transactionTypes.forEach(tx => (relayerFees[tx.name] = relayerFees[tx.name] ?? defaultFee));

  return relayerFees;
}

async function getTransactions() {
  const transactionDataSource = await dataSource.getRepository(TRANSACTION_TABLE);

  return await transactionDataSource.find({
    where: {
      enabled: true
    }
  });
}

async function getSingleFee(feeDataSource, relayer, userPk, transactionName) {
  let feeRow = await feeDataSource.findOne({
    where: {
      relayerId: relayer.id,
      userPublicKey: userPk || IsNull(),
      enabled: true,
      transaction: { name: transactionName, enabled: true }
    }
  });

  return feeRow ? feeRow.fee : relayer.defaultFee;
}

async function getAllFees(feeDataSource, relayer, userPk) {
  const fees = await feeDataSource.find({
    where: {
      relayerId: relayer.id,
      userPublicKey: userPk || IsNull(),
      enabled: true
    }
  });

  const transactionTypes = await getTransactions();

  return buildFeesJson(fees, relayer.defaultFee, transactionTypes);
}

async function getRelayerVaultId(relayerAddress) {
  if (!relayerAddress) throw new Error(`Invalid relayer address ${relayerAddress}`);

  const relayer = await getRelayer(relayerAddress);
  if (!relayer) throw new Error(`Relayer (${relayerAddress}) cannot be found.`);

  return relayer.vaultId;
}

function getPublicKey(account) {
  if (!account) throw new Error(`Address is NULL`);
  if (isHex(account) && account.length != 66) throw new Error(`Invalid hex encoded address ${account}`);

  try {
    return u8aToHex(decodeAddress(account));
  } catch (err) {
    throw new Error(`Invalid address ${account}: ${err.toString()}`);
  }
}

async function getActiveWebhooks() {
  try {
    const webhooksData = await dataSource
      .getRepository(WEBHOOKS_TABLE)
      .createQueryBuilder('webhooks')
      .select(['webhook.endpoint', 'event.type', 'event.description', 'payer.publicKey'])
      .innerJoin('webhooks.endpoint', 'webhook')
      .innerJoin('webhooks.webhookEvent', 'event')
      .innerJoin('webhook.payers', 'payer', 'payer.enabled = :enabled', { enabled: true })
      .getMany();

    console.log('[WEBHOOKS DATA]', webhooksData);
    const activeWebhooks = {};
    webhooksData.forEach(({ webhook, event, payer }) => {
      if (!activeWebhooks[payer.publicKey]) {
        activeWebhooks[payer.publicKey] = { endpoint: webhook.endpoint, eventTypes: {} };
      }
      activeWebhooks[payer.publicKey].eventTypes[event.type] = event.description;
    });

    return activeWebhooks;
  } catch (error) {
    throw new Error(`Failed to get active webhooks: ${error.message}`);
  }
}

async function getWebhookEventTypes() {
  try {
    const webhookEventDataSource = await dataSource.getRepository(WEBHOOK_EVENT_TABLE);
    return (await webhookEventDataSource.find()).reduce((webhookEvents, { type, description }) => {
      webhookEvents[type] = description;
      return webhookEvents;
    }, {});
  } catch (error) {
    throw new Error(`Failed to get webhook event types: ${error.message}`);
  }
}

async function getWebhookEndpointCount() {
  return await dataSource.getRepository(WEBHOOK_ENDPOINT_TABLE).count();
}

async function getWebhookEndpointLastUpdated() {
  const result = await dataSource
    .getRepository(WEBHOOK_ENDPOINT_TABLE)
    .createQueryBuilder('endpoint')
    .select('MAX(endpoint.updatedAt)', 'last_update_time')
    .getRawOne();

  return result.last_update_time;
}

async function getWebhooksCount() {
  return await dataSource.getRepository(WEBHOOKS_TABLE).count();
}

async function getWebhooksLastUpdated() {
  const result = await dataSource
    .getRepository(WEBHOOKS_TABLE)
    .createQueryBuilder('event')
    .select('MAX(event.updatedAt)', 'last_update_time')
    .getRawOne();

  return result.last_update_time;
}

module.exports = {
  getPayer,
  getFees,
  getPublicKey,
  getRelayerVaultId,
  getActiveWebhooks,
  getWebhookEndpointLastUpdated,
  getWebhookEndpointCount,
  getWebhookEventTypes,
  getWebhooksCount,
  getWebhooksLastUpdated,
  init,
  isPayerTransaction
};
