const config = require('multiconfig').load();
const typeorm = require("typeorm");
const { isHex, u8aToHex } = require('@polkadot/util');
const { decodeAddress, encodeAddress } = require('@polkadot/util-crypto');

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
      require("./entity/payerTransaction"),
      require("./entity/fee"),
      require("./entity/relayer")
    ],
  });

  await dataSource.initialize();

  return dataSource;
}

async function getPayer(user, payer) {
  const userPublicKey = getPublicKey(user);

  if (!userPublicKey && !payer) return undefined;

  const userDataSource = await dataSource.getRepository(SPLIT_FEE_USER_TABLE);

  const splitFeeUser = await userDataSource.findOne({ where: { publicKey: userPublicKey, enabled: true }, relations: ['payer']});
  if (!splitFeeUser) return undefined;

  // This check is useful when we start supporting multiple payers for the same user.
  if (payer) {
    const payerPublicKey = getPublicKey(payer);
    return splitFeeUser.payer.publicKey === payerPublicKey ? encodeAddress(payerPublicKey, 42) : undefined;
  }

  return encodeAddress(splitFeeUser.payer.publicKey, 42);
}

// This function will return the fee as a string
async function getFees(relayerAddress, user, transactionName) {
  const relayer =  await getRelayer(relayerAddress);
  if (!relayer) throw new Error(`Relayer (${relayerAddress}) cannot be found.`);

  const feeDataSource = await dataSource.getRepository(FEE_TABLE);

  let feeRecord;

  if (user && transactionName) {
    const userPk = getPublicKey(user);

    // check if there is a custom fee for transaction and user
    feeRecord = await feeDataSource.findOne(
      { where: {
          relayerId: relayer.id,
          userPublicKey: userPk,
          enabled: true,
          transaction: { name: transactionName, enabled: true }
        },
        relations: ['transaction']
      },
    );
  }

  // check if there is a specific fee for that transaction instead
  if (!feeRecord && transactionName) {
      feeRecord = await feeDataSource.findOne(
          { where:
            { relayerId: relayer.id, enabled: true, transaction: { name: transactionName, enabled: true }},
            relations: ['transaction']
          }
      );
  }

  // check if there is a default fee for the given relayer
  if (!feeRecord) {
      feeRecord = await feeDataSource.findOne(
          { where: { relayerId: relayer.id, enabled: true}}
      );
  }

  // There must be at least 1 fee entry for each relayer
  if (!feeRecord) throw new Error(`Relayer fee cannot be found for relayer: ${relayerAddress}, user: ${user} and tx: ${transactionName}`);

  return feeRecord.fee;
}

async function getRelayer(relayerAddress) {
  if (!relayerAddress) return undefined;

  const relayerPk = getPublicKey(relayerAddress);
  const relayerDataSource = await dataSource.getRepository(RELAYER_TABLE);
  return await relayerDataSource.findOne({ where: { publicKey: relayerPk, enabled: true }});
}

function getPublicKey(account) {
  if (!account) throw new Error(`Address is NULL`);
  if (isHex(account) && account.length != 66) throw new Error(`Invalid hex encoded address ${account}`);

  try {
      return u8aToHex(decodeAddress(account));
  } catch (err) {
      throw new Error(`Invalid address ${account}: ${err.toString()}`)
  }
}

module.exports = {
  getPayer,
  getFees,
  init,
};
