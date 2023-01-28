const config = require('multiconfig').load();
const typeorm = require("typeorm");

const SPLIT_FEE_USER_TABLE = 'splitFeeUser';
const FEE_TABLE = 'fee';
const RELAYER_TABLE = 'relayer';

async function init() {
  const dataSource = new typeorm.DataSource({
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
  let userPublicKey = getPublicKey(user);
  let payerPublicKey = getPublicKey(payer);

  if (!userPublicKey && !payerPublicKey) return undefined;

  const userDataSource = await dataSource.getRepository(SPLIT_FEE_USER_TABLE);

  const splitFeeUser = await userDataSource.findOne({ where: { publicKey: userPublicKey, enabled: true }, relations: ['payer']});
  if (!splitFeeUser) return undefined;

  if (payerPublicKey) {
    return splitFeeUser.payer.publicKey === payerPublicKey ? encodeAddress(payerPublicKey, 42) : undefined;
  }

  return encodeAddress(splitFeeUser.payer.publicKey, 42);
}

async function getRelayerFee(dataSource, relayerId, txId, user) {
  let userPk = getPublicKey(user);

  const relayerDataSource = await dataSource.getRepository(RELAYER_TABLE);
  const feeDataSource = await dataSource.getRepository(FEE_TABLE);

  let relayer = await relayerDataSource.findOne({ where: { id: relayerId, enabled: true }});
  if (!relayer) return undefined;

  // check if there is a custom fee for transaction and user
  let feeRecord = await feeDataSource.findOne(
      { where: {
          relayerId: relayerId,
          transactionId: txId,
          userPublicKey: userPk,
          enabled: true
        }
      }
  );

  // check if there is a specific fee for that transaction instead
  if (!feeRecord) {
      feeRecord = await feeDataSource.findOne(
          { where: { relayerId: relayerId, transactionId: txId, enabled: true}}
      );
  }

  // check if there is a default fee for the given relayer
  if (!feeRecord) {
      feeRecord = await feeDataSource.findOne(
          { where: { relayerId: relayerId, enabled: true}}
      );
  }

  if (!feeRecord) return undefined;

  return feeRecord.fee;
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
  getRelayerFee,
  init,
};
