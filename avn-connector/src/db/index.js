const config = require('multiconfig').load();
const typeorm = require("typeorm");

const SPLIT_FEE_USER_TABLE = 'splitFeeUser';
const FEE_TABLE = 'fee';
const RELAYER_TABLE = 'relayer';

let dataSource;

async function init() {
  dataSource = new typeorm.DataSource({
    type: "postgres",
    host: config.postgres.host,
    port: config.postgres.port,
    username: config.postgres.username,
    password: config.postgres.password,
    database: config.postgres.database,
    synchronize: config.postgres.synchronize,
    entities: [
      require("./entity/payer"),
      require("./entity/splitFeeUser"),
      require("./entity/transaction"),
      require("./entity/payerTransaction")
    ],
  });

  await dataSource.initialize();

  return dataSource;
}

async function getPayer(user, payer) {
  const userPublicKey = getPublicKey(user);
  const payerPublicKey = getPublicKey(payer);

  if (!userPublicKey && !payerPublicKey) return undefined;

  const userDataSource = await dataSource.getRepository(SPLIT_FEE_USER_TABLE);

  const splitFeeUser = await userDataSource.findOne({ where: { publicKey: userPublicKey, enabled: true }, relations: ['payer']});
  if (!splitFeeUser) return undefined;

  // This check is useful when we start supporting multiple payers for the same user.
  if (payerPublicKey) {
    return splitFeeUser.payer.publicKey === payerPublicKey ? encodeAddress(payerPublicKey, 42) : undefined;
  }

  return encodeAddress(splitFeeUser.payer.publicKey, 42);
}

// This function will return the fee as a string
async function getFees(relayerAddress, user, txId) {
  const relayer =  await getRelayer(relayerAddress);
  if (!relayer) throw new Error(`Relayer (${relayerAddress}) cannot be found.`);

  const userPk = getPublicKey(user);
  const feeDataSource = await dataSource.getRepository(FEE_TABLE);

  let feeRecord;

  if (userPk && txId) {
    // check if there is a custom fee for transaction and user
    feeRecord = await feeDataSource.findOne(
      { where: {
          relayerId: relayer.id,
          transactionId: txId,
          userPublicKey: userPk,
          enabled: true
        }
      }
    );
  }

  // check if there is a specific fee for that transaction instead
  if (!feeRecord && txId) {
      feeRecord = await feeDataSource.findOne(
          { where: { relayerId: relayer.id, transactionId: txId, enabled: true}}
      );
  }

  // check if there is a default fee for the given relayer
  if (!feeRecord) {
      feeRecord = await feeDataSource.findOne(
          { where: { relayerId: relayer.id, enabled: true}}
      );
  }

  // There must be at least 1 fee entry for each relayer
  if (!feeRecord) throw new Error(`Relayer fee cannot be found for relayer: ${relayerAddress}, user: ${user} and tx: ${txId}`);

  return feeRecord.fee;
}

async function getRelayer(relayerId) {
  const relayerPk = getPublicKey(relayerId);
  const relayerDataSource = await dataSource.getRepository(RELAYER_TABLE);
  return await relayerDataSource.findOne({ where: { id: relayerPk, enabled: true }});
}

function getPublicKey(account) {
  if (!account) return undefined;
  if (isHex(account) && account.length != 66) return undefined;

  try {
      return u8aToHex(decodeAddress(account));
  } catch (err) {
      return undefined;
  }
}

module.exports = {
  getPayer,
  getFees,
  init,
};
