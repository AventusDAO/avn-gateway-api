const config = require('multiconfig').load();
const typeorm = require("typeorm");
const { IsNull } = require("typeorm");
const { isHex, u8aToHex } = require('@polkadot/util');
const { decodeAddress, encodeAddress } = require('@polkadot/util-crypto');

const SPLIT_FEE_USER_TABLE = 'splitFeeUser';
const FEE_TABLE = 'fee';
const RELAYER_TABLE = 'relayer';
const PAYER_TRANSACTION_TABLE = 'payerTransaction';

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

  return {payerId: splitFeeUser.id, payerAddress: encodeAddress(splitFeeUser.publicKey, 42)};
}

// This function will return the fee as a string
async function getFees(relayerAddress, user, transactionName) {
  let userPk;

  const relayer =  await getRelayer(relayerAddress);
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

  let payerTx = await payerTransactionDataSource.findOne(
    { where: {
        payer: { publicKey: payerPk, enabled: true},
        transaction: { name: transactionName, enabled: true },
        enabled: true }
    }
  );

  return payerTx ? true : false;
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
  Object.values(transactionTypes).forEach(v => relayerFees[v] = relayerFees[v] ?? defaultFee);

  return relayerFees;
}

async function getSingleFee(feeDataSource, relayer, userPk, transactionName) {
  let feeRow = await feeDataSource.findOne(
      { where: {
          relayerId: relayer.id,
          userPublicKey: userPk || IsNull(),
          enabled: true,
          transaction: { name: transactionName, enabled: true }
      }
  });

  return feeRow ? feeRow.fee : relayer.defaultFee;
}

async function getAllFees(feeDataSource, relayer, userPk) {
  const fees = await feeDataSource.find(
      { where: {
          relayerId: relayer.id,
          userPublicKey: userPk || IsNull(),
          enabled: true
  }});

  return buildFeesJson(fees, relayer.defaultFee);
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
  isPayerTransaction,
};
