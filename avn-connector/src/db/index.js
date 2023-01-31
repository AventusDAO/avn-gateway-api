const config = require('multiconfig').load();
const typeorm = require("typeorm");
const { IsNull } = require("typeorm");
const { isHex, u8aToHex } = require('@polkadot/util');
const { decodeAddress, encodeAddress } = require('@polkadot/util-crypto');

const SPLIT_FEE_USER_TABLE = 'splitFeeUser';
const FEE_TABLE = 'fee';
const RELAYER_TABLE = 'relayer';

const transactionTypes = {
  proxyAvtTransfer: 'proxyAvtTransfer',
  proxyTokenTransfer: 'proxyTokenTransfer',
  proxyConfirmTokenLift: 'proxyConfirmTokenLift',
  proxyTokenLower: 'proxyTokenLower',
  proxyMintSingleNft: 'proxyMintSingleNft',
  proxyListNftOpenForSale: 'proxyListNftOpenForSale',
  proxyTransferFiatNft: 'proxyTransferFiatNft',
  proxyCancelListFiatNft: 'proxyCancelListFiatNft',
  proxyStakeAvt: 'proxyStakeAvt',
  proxyIncreaseStake: 'proxyIncreaseStake',
  proxyUnstake: 'proxyUnstake',
  proxyWithdrawUnlocked: 'proxyWithdrawUnlocked',
}

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
  let fees, userPk;

  const relayer =  await getRelayer(relayerAddress);
  if (!relayer) throw new Error(`Relayer (${relayerAddress}) cannot be found.`);
  //if (!relayer.defaultFee) throw new Error(`Relayer  ${relayerAddress} does not have a default fee set`);

  const feeDataSource = await dataSource.getRepository(FEE_TABLE);

  if (user) {
    userPk = getPublicKey(user);
  }

  // The order of the if statements matter here because we want to check for
  // the most specific 'fee' first (user and tx), then user specific 'fee' and finally transaction specific 'fee'.
  if (userPk && transactionName) {
      fees = await getSingleFee(feeDataSource, relayer.id, userPk, transactionName);
      if (fees) return fees.fee;
  }

  // Check if there is a default fee for user
  if (!fees && userPk) {
      fees = await getAllFees(feeDataSource, relayer.id, userPk);
  }

  // Note: `find` returns an empty array so a null check is not enough, check for length as well.
  // Check if there is a default fee transaction
  if ((!fees || fees.length === 0) && transactionName) {
      fees = await getSingleFee(feeDataSource, relayer.id, IsNull(), transactionName);
      if (fees) return fees.fee;
  }

  // TODO: replace me with a real value
  return buildFeesJson(fees, relayer.defaultFee || '0');
}

async function getRelayer(relayerAddress) {
  if (!relayerAddress) return undefined;

  const relayerPk = getPublicKey(relayerAddress);
  const relayerDataSource = await dataSource.getRepository(RELAYER_TABLE);
  return await relayerDataSource.findOne({ where: { publicKey: relayerPk, enabled: true }});
}

// This function expects that each relayer has at least one default fee or a fee for each transaction type.
function buildFeesJson(dbResult, relayerDefaultFee) {
  let defaultFee;
  let relayerFees = {};

  (dbResult || []).forEach(r => {
      if (r.transaction && r.transaction.name) {
          relayerFees[r.transaction.name] = r.fee;
      } else {
          defaultFee = r.fee;
      }
  });

  defaultFee = defaultFee ?? relayerDefaultFee;
  Object.values(transactionTypes).forEach(v => relayerFees[v] = relayerFees[v] ? relayerFees[v] : defaultFee);

  return relayerFees;
}

async function getSingleFee(feeDataSource, relayerId, userPk, transactionName) {
  return await feeDataSource.findOne(
      { where: {
          relayerId: relayerId,
          userPublicKey: userPk,
          enabled: true,
          transaction: { name: transactionName, enabled: true }
      }});
}

async function getAllFees(feeDataSource, relayerId, userPk) {
  return await feeDataSource.find(
      { where: {
          relayerId: relayerId,
          userPublicKey: userPk,
          enabled: true
      }});
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
