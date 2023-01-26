const config = require('multiconfig').load();
const typeorm = require("typeorm");
const { isHex, u8aToHex } = require('@polkadot/util');
const { encodeAddress, decodeAddress } = require('@polkadot/util-crypto');

const SPLIT_FEE_USER_TABLE = 'splitFeeUser';

let dataSource;
async function init() {
  dataSource = new typeorm.DataSource({
    type: "postgres",
    host: config.postgress.host,
    port: config.postgress.port,
    username: config.postgress.username,
    password: config.postgress.password,
    database: config.postgress.database,
    synchronize: config.postgress.synchronize,
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

  const splitFeeUser = await userDataSource.findOne({ where: { publicKey: userPublicKey }, relations: ['payer']});
  if (!splitFeeUser) return undefined;

  if (payerPublicKey) {
    return splitFeeUser.payer.publicKey === payerPublicKey ? encodeAddress(payerPublicKey, 42) : undefined;
  }

  return encodeAddress(splitFeeUser.payer.publicKey, 42);
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
  init,
};
