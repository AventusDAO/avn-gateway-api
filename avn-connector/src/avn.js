'use strict';
const { ApiPromise, WsProvider, Keyring } = require('@polkadot/api');
const { isHex } = require('@polkadot/util');
const config = require('multiconfig').load();
const log4js = require('log4js');
const log = log4js.getLogger();
const avnTypes = require('avn-types');
const redis = require('./redis');
const axios = require('axios');
const Vault = require('./vaultApp');
const stakingHelper = require('./stakingHelper');

const AVN_URL = config.avnUrl;
const ETHERSCAN_URL = config.etherscan.url;
const ETHERSCAN_API_KEY = config.etherscan.apiKey;

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

    let summaryAtBlock;

    if (tx.blockNumber) {
      summaryAtBlock = getSummaryRange(tx.blockNumber)[1];
    }

    return { txHash, status: tx.status, blockNumber: tx.blockNumber, transactionIndex: tx.transactionIndex, summaryAtBlock };
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

async function getLowerData(blockNumber, transactionIndex) {
  let lowerData = {};
  let summaryData = await getSummaryData(blockNumber);

  if (summaryData.ethTxHash) {
    try {
      let range = summaryData.summaryRange;
      log.trace({ message: 'Getting lower data', range, blockNumber, transactionIndex, ethTxHash });
      let rpcData = await api.rpc.lower.data(range[0], range[1], blockNumber, transactionIndex);
      const data = JSON.parse(Buffer.from(rpcData, 'hex').toString());
      lowerData.leaf = '0x' + Buffer.from(data.encoded_leaf).toString('hex');
      lowerData.merklePath = '[' + data.merkle_path.join(',').replace(/'/g, '') + ']';
    } catch (err) {
      log.error(`Error getting lower data: ${err}`);
      throw err;
    }
  }
  return lowerData;
}

async function getEthTxHash(summaryRange) {
  if (!summaryRange[0] || !summaryRange[1]) {
    return null;
  }

  let ethTxHash = await redis.getEthTxHashForSummary(summaryRange[1]);

  if (!ethTxHash) {
    let blockHash = await api.rpc.chain.getBlockHash(summaryRange[0]);
    let ingressCounter = (await api.query.summary.totalIngresses.at(blockHash)) + 1;
    let rootData = await api.query.summary.roots(summaryRange, ingressCounter);
    if (!rootData.tx_id) {
      return null;
    }

    let transactionId = rootData.tx_id.toString();
    let ethTransactionCandidate = await api.query.ethereumTransactions.repository(transactionId);
    ethTxHash = ethTransactionCandidate.eth_tx_hash;
    if (ethTxHash === '0x0000000000000000000000000000000000000000000000000000000000000000') {
      return null;
    }
console.log('I', `${ETHERSCAN_URL}module=transaction&action=gettxreceiptstatus&txhash=${ethTxHash}&apikey=${ETHERSCAN_API_KEY}`)
    let receipt = await axios.get(
      `${ETHERSCAN_URL}module=transaction&action=gettxreceiptstatus&txhash=${ethTxHash}&&apikey=${ETHERSCAN_API_KEY}`
    );

    console.log('J', receipt.data)

    if (receipt.data.result.status !== '1') {
      return null;
    } else {
      console.log('K', ethTxHash)
      await redis.setEthTxHashForSummary(summaryRange[1], ethTxHash);
    }
  }

  return ethTxHash;
}

// TODO: Replace this function with DB call for actual summary that accounts for schedule period changes
function getSummaryRange(blockNumber) {
  if (!blockNumber) {
    return [null, null];
  }

  const SCHEDULE_PERIOD = 28800;
  blockNumber = parseInt(blockNumber);
  let summaryFromBlock = 1 + Math.floor(blockNumber / SCHEDULE_PERIOD) * SCHEDULE_PERIOD;
  const summaryToBlock = summaryFromBlock + SCHEDULE_PERIOD - 1;
  summaryFromBlock = summaryFromBlock === 1 ? 0 : summaryFromBlock;
  return [summaryFromBlock.toString(), summaryToBlock.toString()];
}

async function getSummaryData(blockNumber) {
  let currentBlock = (await api.query.system.number()).toString();

  if (!blockNumber) {
    blockNumber = currentBlock;
  } else if (parseInt(blockNumber) > parseInt(currentBlock)) {
    blockNumber = null;
  } else {
    blockNumber = blockNumber.toString();
  }

  const summaryRange = getSummaryRange(blockNumber);
  let ethTxHash = await getEthTxHash(summaryRange);
  return { blockNumber, summaryRange, ethTxHash };
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
    typesBundle: avnTypes,
    rpc: {
      lower: {
        data: {
          params: [
            {
              name: 'from_block',
              type: 'u32'
            },
            {
              name: 'to_block',
              type: 'u32'
            },
            {
              name: 'block_number',
              type: 'u32'
            },
            {
              name: 'extrinsic_index',
              type: 'u32'
            }
          ],
          type: 'Text'
        }
      }
    }
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
  getLowerData,
  getSummaryData,
  getValidatorsToNominate,
  init,
  query,
  proxy,
  poll,
  getStakingStats
};
