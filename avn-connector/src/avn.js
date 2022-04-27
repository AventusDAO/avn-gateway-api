'use strict';
const { ApiPromise, WsProvider, Keyring } = require('@polkadot/api');
const { isHex } = require('@polkadot/util');
const config = require('multiconfig').load();
const log4js = require('log4js');
const log = log4js.getLogger();
const avnTypes = require('avn-types');
const redis = require('./redis');
const ethereum = require('./ethereum');
const Vault = require('./vaultApp');
const stakingHelper = require('./stakingHelper');

const AVN_URL = config.avnUrl;

let api, vault;
let relayers = {};

async function query(palletName, storageName, params) {
  let result;

  if (params[0] === 'entries') {
    result = await api.query[palletName][storageName].entries();
  } else {
    result = await api.query[palletName][storageName](...params);
    result = result.toJSON();
  }

  log.trace(`Encoded query response: ${result}`);
  return JSON.stringify(result);
}

async function proxy(requestId, palletName, method, params) {
  if (palletName === 'utility' && method === 'batchAll') {
    log.trace({
      message: `Creating batch transactions.`,
      extrinsic: params.map(p => `api.tx.${p.palletName}.proxy`).join(', ')
    });

    const innerCalls = params.map(p => {
      let innerCall = api.tx[p.palletName][p.method](...p.params.proxyParams);
      return api.tx.avnProxy.proxy(innerCall, p.params.paymentInfo);
    });
    const txn = api.tx.utility.batchAll(innerCalls);
    return await signAndSend(requestId, params[0].params.relayerAddress, txn);
  } else {
    log.trace({ message: 'Creating inner call from extrinsic', extrinsic: `api.tx.${palletName}.proxy` });

    const innerCall = api.tx[palletName][method](...params.proxyParams);
    const txn = api.tx.avnProxy.proxy(innerCall, params.paymentInfo);
    return await signAndSend(requestId, params.relayerAddress, txn);
  }
}

async function poll(requestId) {
  if (!requestId) {
    log.error(`Unknown request: ${requestId}`);
    return { error: 'Bad request' };
  }

  try {
    let txHash = isTransactionHash(requestId) ? requestId : await redis.getTransactionHashByRequestId(requestId);
    let tx = await redis.getAvnTransaction(txHash);

    if (!tx) {
      log.error(`No transaction found for requestId: ${requestId}`);
      return { error: 'Transaction not found' };
    }

    return { txHash, status: tx.status, blockNumber: tx.blockNumber, transactionIndex: tx.transactionIndex };
  } catch (error) {
    log.error(`Error getting transaction status for requestId ${requestId}: ${error}`);
    throw new Error(`Unable to get transaction status for requestId: ${requestId}`);
  }
}

async function getAccountInfo(accountId) {
  let stakingInfo = await api.derive.staking.account(accountId);
  let balancesAll = await api.derive.balances.all(accountId);

  return {
    totalBalance: balancesAll.freeBalance.add(balancesAll.reservedBalance).toString(),
    freeBalance: balancesAll.availableBalance.toString(),
    stakedBalance: stakingHelper.calculateBondedAmount(stakingInfo).toString(),
    unlockedBalance: stakingInfo.redeemable.toString(),
    unstakedBalance: stakingHelper.calculateUnbondingAmount(stakingInfo).toString()
  };
}

async function getNonce(senderAddress) {
  let nonce = await redis.getNextNonce(senderAddress);
  if (!nonce) {
    nonce = (await api.query.system.account(senderAddress)).nonce;
    await redis.setNonce(senderAddress, nonce);
  } else {
    redis.refreshNonce(senderAddress);
  }
  return nonce;
}

async function getValidatorsToNominate() {
  let validators = await redis.getValidatorsToNominate();

  if (!validators) {
    let validatorsInfo = await api.derive.staking.electedInfo({ withPrefs: true });
    validators = validatorsInfo.info
      .filter(i => i.validatorPrefs.blocked && i.validatorPrefs.blocked.isFalse === true)
      .map(i => i.accountId);

    await redis.setValidatorsToNominate(JSON.stringify(validators));
  }

  return validators;
}

async function getStakingStats() {
  let stakingStats = await redis.getStakingStats();

  if (!stakingStats) {
    const stakersData = await api.derive.staking.electedInfo({withExposure: true});

    const [minUserBond, maxNominatorsRewardedPerValidator] = await Promise.all([
      api.query.validatorsManager.minUserBond(),
      api.consts.staking.maxNominatorRewardedPerValidator
    ]);

    stakingStats = stakingHelper.calculateStakingStats(stakersData, minUserBond, maxNominatorsRewardedPerValidator);
    await redis.setStakingStats(JSON.stringify(stakingStats));
  }

  return stakingStats;
}

async function getChainInfo() {
  let chainInfo = await redis.getChainInfo();

  if (!chainInfo) {
    chainInfo = {};
    chainInfo.name = await api.rpc.system.chain();
    chainInfo.version = api.runtimeVersion.specVersion.toString();

    await redis.setChainInfo(JSON.stringify(chainInfo));
  }

  return chainInfo;
}

async function getCurrentBlock() {
  return (await api.derive.chain.bestNumberFinalized()).toString();
}

async function getSummaryData(blockNumber) {
  let currentBlock = await getCurrentBlock();

  if (!blockNumber) {
    blockNumber = currentBlock;
  } else if (parseInt(blockNumber) > parseInt(currentBlock)) {
    return { blockNumber: blockNumber.toString(), summaryRange: [], ethTxHash: null };
  } else {
    blockNumber = blockNumber.toString();
  }

  const summaryRange = calculateSummaryRange(blockNumber);
  let ethTxHash = await retrieveEthTxHashIfExists(summaryRange);
  return { blockNumber, summaryRange, ethTxHash };
}

// TODO: Does not account for changes of schedule period, replace with a function that retrieves summary ranges from a database
function calculateSummaryRange(blockNumber) {
  const SCHEDULE_PERIOD = 28800;
  blockNumber = parseInt(blockNumber);
  let summaryFromBlock = 1 + Math.floor(blockNumber / SCHEDULE_PERIOD) * SCHEDULE_PERIOD;
  const summaryToBlock = summaryFromBlock + SCHEDULE_PERIOD - 1;
  summaryFromBlock = summaryFromBlock === 1 ? 0 : summaryFromBlock;
  return [summaryFromBlock.toString(), summaryToBlock.toString()];
}

async function retrieveEthTxHashIfExists(summaryRange) {
  let ethTxHash = await redis.getSummaryEthTxHash(summaryRange);

  if (!ethTxHash) {
    console.log('A')
    let blockHash = await api.rpc.chain.getBlockHash(summaryRange[1]);
    console.log('B', blockHash)
    if (!blockHash) {
      console.log('C')
      return null;
    }
    console.log('D')
    let ingressCounter = parseInt(await api.query.summary.totalIngresses.at(blockHash)) + 1;
    let transactionId = (await api.query.summary.roots(summaryRange, ingressCounter)).tx_id.toString();
    if (!transactionId) {
      return null;
    }

    let ethTransactionCandidate = await api.query.ethereumTransactions.repository(transactionId);
    ethTxHash = ethTransactionCandidate.eth_tx_hash.toString();
    if ((await ethereum.transactionExists(ethTxHash)) === false) {
      return null;
    }

    await redis.setSummaryEthTxHash(summaryRange, ethTxHash);
  }

  return ethTxHash;
}

async function signAndSend(requestId, relayerAddress, txn) {
  let result, nonce, relayerAccount;

  try {
    log.trace({ message: 'Getting relayer account', address: relayerAddress });
    relayerAccount = await getRelayerAccount(relayerAddress);
  } catch (err) {
    log.error(`Error getting relayer account for ${relayerAddress}: ${err}`);
    throw err;
  }

  try {
    log.trace({ encodedTransaction: txn });
    nonce = await getNonce(relayerAccount.address);
    let signedTx = await txn.signAsync(relayerAccount, { nonce });
    let receipt = await signedTx.send();
    result = { transactionHash: receipt.toString() };
  } catch (err) {
    log.error(`Failed sending transaction: ${err}`);
    await redis.resetNonce(relayerAccount.address);

    // If we failed to get a true transaction hash, use the requestId as key
    if (!result || !result.transactionHash) {
      result.transactionHash = requestId;
    }
    await redis.addFailedAvnTransaction(requestId, result.transactionHash, relayerAccount.address.toString(), nonce.toString());

    throw err;
  }

  await redis.addPendingAvnTransaction(requestId, result.transactionHash, relayerAccount.address.toString(), nonce.toString());

  return result;
}

async function getRelayerAccount(relayerAddress) {
  if (!relayers[relayerAddress]) {
    const relayerSuri = await vault.getRelayerSeed(relayerAddress);
    relayers[relayerAddress] = createAccount(relayerSuri);
  }
  return relayers[relayerAddress];
}

async function init() {
  await connectToAvN();
  vault = new Vault(config.vault.vault_url, config.vault.app_role_id, config.vault.app_secret_id);
}

async function connectToAvN() {
  log.info(`Creating a connection to the AVN on: ${AVN_URL}`);

  let provider = new WsProvider(AVN_URL);
  api = await ApiPromise.create({
    provider,
    typesBundle: avnTypes
  });

  const [chain, nodeName, nodeVersion] = await Promise.all([
    api.rpc.system.chain(),
    api.rpc.system.name(),
    api.rpc.system.version()
  ]);

  log.info(`You are connected to chain ${chain} (${AVN_URL}) using ${nodeName} v${nodeVersion}\n`);
}

function createAccount(suri) {
  const keyring = new Keyring({ type: 'sr25519' });
  return keyring.addFromUri(suri);
}

function isTransactionHash(requestId) {
  return isHex(requestId) && requestId.split('').length == 66;
}

module.exports = {
  getAccountInfo,
  getValidatorsToNominate,
  init,
  query,
  proxy,
  poll,
  getStakingStats,
  getChainInfo,
  getCurrentBlock,
  getSummaryData
};
