'use strict';
const { ApiPromise, WsProvider, Keyring } = require('@polkadot/api');
const { isHex, stringToHex, u8aToHex } = require('@polkadot/util');
const { keccakAsHex } = require('@polkadot/util-crypto');
const config = require('multiconfig').load();
const log4js = require('log4js');
const log = log4js.getLogger();
const avnTypes = require('avn-types');
const redis = require('./redis');
const ethereum = require('./ethereum');
const Vault = require('./vaultApp');
const stakingHelper = require('./stakingHelper');
const fees = require('./paymentInfoHelper');

const AVN_URL = config.avnUrl;
const RELAYER_ADDRESS = config.relayer.address;

let api, vault;
let relayers = {};

async function query(palletName, storageName, params) {
  let result;

  if (params[0] === 'entries') {
    result = await api.query[palletName][storageName].entries();
  } else if (params[0] === 'keys') {
    result = await api.query[palletName][storageName].keys();
  } else if (params[0] === 'at') {
    const blockHash = await api.rpc.chain.getBlockHash(params[1]);
    result = await api.query[palletName][storageName].at(blockHash, ...params.slice(2));
    result = result.toJSON();
  } else {
    result = await api.query[palletName][storageName](...params);
    result = result.toJSON();
  }

  log.trace(`Encoded query response: ${JSON.stringify(result)}`);
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
    const result = await signAndSend(requestId, params[0].params.relayerAddress, txn);

    for (const p of params) {
      await redis.setNextPayerNonce(p.params.splitFeePayerAddress, parseInt(p.params.paymentNonce) + 1);
    }

    return result;

  } else {
    log.trace({ message: 'Creating inner call from extrinsic', extrinsic: `api.tx.${palletName}.proxy` });

    const innerCall = api.tx[palletName][method](...params.proxyParams);
    const txn = api.tx.avnProxy.proxy(innerCall, params.paymentInfo);
    const result = await signAndSend(requestId, params.relayerAddress, txn);

    if (params.splitFeePayerAddress) {
      await redis.setNextPayerNonce(params.splitFeePayerAddress, parseInt(params.paymentNonce) + 1);
    }

    return result;
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
      log.warn(`No transaction found for requestId: ${requestId}`);
      return { status: `Transaction not found` };
    }

    return { txHash, status: tx.status, blockNumber: tx.blockNumber, transactionIndex: tx.transactionIndex, senderNonce: tx.senderNonce };
  } catch (error) {
    log.error(`Error getting transaction status for requestId ${requestId}: ${error}`);
    throw new Error(`Unable to get transaction status for requestId: ${requestId}`);
  }
}

async function getAccountInfo(accountId) {
  let balancesAll = await api.derive.balances.all(accountId);
  let currentEraIndex = (await api.query.parachainStaking.era()).current;
  let collators = await getCollatorsToNominate(api);
  let stakedBalance, unlockedBalance, unstakedBalance;

  if (collators.some(c => c.toLowerCase() === accountId.toLowerCase())) {
    const candidateInfo = await api.query.parachainStaking.candidateInfo(accountId);
    ({ stakedBalance, unlockedBalance, unstakedBalance } = stakingHelper.calculateCollatorStakingBalances(
      candidateInfo,
      currentEraIndex
    ));
  } else {
    const nominatorState = await api.query.parachainStaking.nominatorState(accountId);
    let allRequests = await api.query.parachainStaking.nominationScheduledRequests.multi(collators);

    let nominatorRequests = allRequests.flat().filter(req => req.nominator.eq(accountId));

    ({ stakedBalance, unlockedBalance, unstakedBalance } = stakingHelper.calculateNominatorStakingBalances(
      nominatorState,
      nominatorRequests,
      currentEraIndex
    ));
  }

  return {
    totalBalance: balancesAll.freeBalance.add(balancesAll.reservedBalance).toString(),
    freeBalance: balancesAll.availableBalance.toString(),
    stakedBalance: stakedBalance.toString(),
    unlockedBalance: unlockedBalance.toString(),
    unstakedBalance: unstakedBalance.toString()
  };
}

async function getCollatorsToNominate() {
  let collators = await redis.getCollatorsToNominate();

  if (collators === undefined) {
    let collators = await api.query.parachainStaking.selectedCandidates();
    await redis.setCollatorsToNominate(collators);
  }

  return collators;
}

async function getStakingStats() {
  let stakingStats = await redis.getStakingStats();
  if (stakingStats === undefined) {
    const [minUserBond, maxNominatorsRewardedPerValidator, totalStaked, stakersData] = await Promise.all([
      api.query.parachainStaking.minTotalNominatorStake(),
      api.consts.parachainStaking.maxTopNominationsPerCandidate,
      api.query.parachainStaking.total(),
      api.query['parachainStaking']['nominatorState'].keys()
    ]);
    let numActiveStakes = stakersData.length;
    const averageStaked = totalStaked.divn(numActiveStakes).toString();
    stakingStats = {
      totalStaked: totalStaked.toString(),
      minUserBond: minUserBond.toString(),
      maxNominatorsRewardedPerValidator: maxNominatorsRewardedPerValidator.toString(),
      totalStakers: stakersData.length,
      averageStaked: averageStaked
    };
    await redis.setStakingStats(stakingStats);
  }
  return stakingStats;
}

async function getChainInfo() {
  let chainInfo = await redis.getChainInfo();

  if (chainInfo === undefined) {
    chainInfo = {};
    chainInfo.name = await api.rpc.system.chain();
    chainInfo.version = api.runtimeVersion.specVersion.toString();
    chainInfo.avtContract = await api.query.tokenManager.avtTokenContract();
    chainInfo.avnContract = await api.query.ethereumEvents.liftingContractAddress();
    await redis.setChainInfo(chainInfo);
  }

  return chainInfo;
}

async function getCurrentBlock() {
  return (await api.derive.chain.bestNumberFinalized()).toString();
}

async function getTotalToken(token) {
  token = token.toLowerCase();
  let total = await redis.getTotalToken(token);

  if (!total) {
    let chainInfo = await getChainInfo();

    if (token === chainInfo.avtContract.toLowerCase()) {
      total = (await api.query.balances.totalIssuance()).toString();
    } else {
      total = await ethereum.getLockedBalance(chainInfo.avnContract, token);
    }

    await redis.setTotalToken(token, total);
  }

  return total;
}

async function getUnprocessedLifts() {
  let unprocessedLifts = [];
  let { avnContract } = await getChainInfo();
  let { fromBlock, toBlock, liftEvents } = await ethereum.getLiftEvents(avnContract);

  if (liftEvents.length > 0) {
    let liftStatuses = await api.query.ethereumEvents.processedEvents.multi(liftEvents);
    for (let [i, isProcessed] of liftStatuses.entries()) {
      if (isProcessed.isFalse) {
        unprocessedLifts.push(liftEvents[i][1]);
      }
    }
  }

  if (unprocessedLifts.length === 0) {
    await redis.setCheckLiftsFromEthBlock(parseInt(toBlock) + 1);
  }

  return { fromBlock, toBlock, unprocessedLifts };
}

async function processLifts(requestId, toBlock, unprocessedLifts) {
  const liftEventType = 1;
  const calls = unprocessedLifts.map(txHash => api.tx.ethereumEvents.addEthereumLog(liftEventType, txHash));
  const txn = api.tx.utility.batch(calls);
  let result;
  try {
    result = await signAndSend(requestId, RELAYER_ADDRESS, txn);
    await redis.setCheckLiftsFromEthBlock(parseInt(toBlock) + 1);
  } catch (err) {
    result = err;
  }
  return result;
}

//This function can be called multiple times (3 by default) from mqConsumer, for the same transaction if it returns an error.
async function signAndSend(requestId, relayerAddress, txn) {
  let transactionHash, nonce, relayerAccount;
  log.trace(`[signAndSend] - Sending ${requestId} to the AvN`);
  try {
    log.trace({ message: 'Getting relayer account', address: relayerAddress });
    relayerAccount = await getRelayerAccount(relayerAddress);
  } catch (err) {
    log.error(`Error getting relayer account for ${relayerAddress}: ${err}`);
    throw err;
  }

  log.trace({ encodedTransaction: txn });

  const nonceLock = await redis.lockNonce(relayerAddress);

  try {
    nonce = await redis.getNextNonce(relayerAddress);
    if (nonce === undefined) nonce = (await api.rpc.system.accountNextIndex(relayerAddress)).toNumber();
    const signedTx = await txn.signAsync(relayerAccount, { nonce: nonce.toString() });
    const receipt = await signedTx.send();
    await redis.setNextNonce(relayerAddress, nonce + 1);
    await nonceLock.release();

    transactionHash = receipt.toString();
    await redis.updateTransactionStatusToPending(
      requestId,
      transactionHash,
      relayerAddress,
      nonce.toString()
    );

    log.trace(`Transaction sent using relayer nonce: ${nonce}, requestId: ${requestId}, transaction hash: ${transactionHash}`);

  } catch (err) {
    await nonceLock.release();

    transactionHash = keccakAsHex(requestId);
    log.error(`Failed sending transaction using relayer nonce: ${nonce}, requestId: ${requestId}, transaction hash: ${transactionHash}, error: `, err);

    await redis.addFailedAvnTransaction(
      requestId,
      transactionHash,
      relayerAddress,
      nonce.toString(),
      redis.transactionStatus.SendingFailed
    );

    throw err;
  }

  return { transactionHash };
}

async function setSendingFailedStatus(requestId, failure) {
  if (!requestId) throw new Error("setSendingFailedStatus - RequestId is mandatory");
  const failureReason = redis.transactionStatus[failure];

  if (!failureReason) throw new Error('Invalid failure reason: ', failure);

  await redis.addFailedAvnTransaction(requestId, keccakAsHex(requestId), undefined, undefined, failureReason);
}

async function addNewTransaction(requestId) {
  if (!requestId) throw new Error("addNewTransaction - RequestId is mandatory");
    const requestIdHash = keccakAsHex(requestId);

    log.trace(`Adding a new transaction for requestId: ${requestId}, txHash: ${requestIdHash}`)
    await redis.addNewAvnTransaction(requestId, requestIdHash);
}

async function getRelayerAccount(relayerAddress) {
  if (!relayers[relayerAddress]) {
    const relayerSuri = await vault.getRelayerSeed(relayerAddress);
    relayers[relayerAddress] = createAccount(relayerSuri);
  }
  return relayers[relayerAddress];
}

async function getNftContractAddresses() {
  const data = await api.query.ethereumEvents.nftT1Contracts.entries();
  return JSON.stringify(data.map(([key, _]) => key.args.map(k => k.toHuman())).flat());
}

async function getGatewayUserInfo(account) {
  const result = await api.queryMulti([
    [api.query.avnProxy.paymentNonces, account],
    [api.query.system.account, account]
  ]);

  let [paymentNonce, { data: balance }] = result;

  return {
    paymentNonce: paymentNonce.toString(),
    freeBalance: balance.free.toString()
  };
}

async function signPaymentInfo(message, payerUsername) {
  log.trace("\n\n[signPaymentInfo] - 1");
  const paymentInfoContext = stringToHex('authorization for proxy payment');
  const messageWithoutPrefix = '0x' + message.slice(4);

  // Important: we only want to sign correctly formatted payment data.
  if (!message || !messageWithoutPrefix.startsWith(paymentInfoContext)) throw new Error('Invalid data to sign.');
  log.trace("[signPaymentInfo] - 2");
  const result = await vault.payerSign(message, payerUsername);
  log.trace("[signPaymentInfo] - 3");
  return result;
}

async function init() {
  vault = new Vault(config.vault.vault_url, config.vault.app_role_id, config.vault.app_secret_id);
  await connectToAvN();
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

async function getSummaries() {
  let entries = [],
    summaries = [],
    startKey;

  do {
    entries = await api.query.summary.roots.entriesPaged({ pageSize: 1000, args: [], startKey });
    if (entries.length > 0) {
      startKey = entries[entries.length - 1][0];
      const formattedEntries = entries.map(
        ([
          {
            args: [{ fromBlock, toBlock }]
          },
          { rootHash, isValidated }
        ]) => ({
          fromBlock: parseInt(fromBlock),
          toBlock: parseInt(toBlock),
          rootHash: rootHash.toString().toLowerCase(),
          isValid: isValidated
        })
      );
      const validEntries = formattedEntries
        .filter(s => s.isValid == true)
        .map(({ fromBlock, toBlock, rootHash }) => ({ fromBlock, toBlock, rootHash }));
      summaries = summaries.concat(validEntries);
    }
  } while (entries.length > 0);

  return summaries.sort((a, b) => (a.fromBlock < b.fromBlock ? -1 : 0));
}

async function getLowerDataFromRpc(fromBlock, toBlock, blockNumber, index) {
  return await api.rpc.lower.data(fromBlock, toBlock, blockNumber, index);
}

function createAccount(suri) {
  const keyring = new Keyring({ type: 'sr25519' });
  return keyring.addFromUri(suri);
}

function isTransactionHash(requestId) {
  return isHex(requestId) && requestId.split('').length == 66;
}

async function getPayerPaymentNonce(payerAddress) {
  const nonceLock = await redis.lockPayerNonce(payerAddress);

  try {
    let nonce = await redis.getNextPayerNonce(payerAddress);
    log.trace(`Payer payment nonce from redis: ${nonce}`)
    if (!nonce) nonce = (await api.query.avnProxy.paymentNonces(payerAddress)).toNumber();
    log.trace(`Payer payment nonce: ${nonce}`)
    await nonceLock.release();
    return nonce;
  } catch (err) {
    log.error(`Error getting payer (${payerAddress}) payment nonce: `, err);
    await nonceLock.release();

    throw err;
  }
}

async function generateSplitFeePaymentInfo(requestId, transaction, paymentNonce) {
  log.trace(`Generating payment info for requestId: ${requestId}, payer: ${transaction.splitFeePayerAddress}, nonce: ${paymentNonce}, amount: ${transaction.relayerFees}`);

  const encodedPaymentParams = fees.encodePaymentParams(
    transaction.relayerAddress,
    transaction.relayerFees,
    paymentNonce,
    transaction.splitFeeProxyProof);

  log.trace("Encoded params");
  const payerUserName = fees.getPayerVaultUsername(transaction.splitFeePayerVaultId);
  log.trace("Signing...");
  const signedData = await signPaymentInfo(u8aToHex(encodedPaymentParams), payerUserName);

  log.trace("Done");
  return {
    payer: transaction.splitFeePayerAddress,
    recipient: transaction.relayerAddress,
    amount: transaction.relayerFees,
    signature: {
      Sr25519: signedData.signature
    }
  };

}

module.exports = {
  addNewTransaction,
  getAccountInfo,
  getCollatorsToNominate,
  getLowerDataFromRpc,
  getStakingStats,
  getChainInfo,
  getCurrentBlock,
  getGatewayUserInfo,
  getSummaries,
  getTotalToken,
  getUnprocessedLifts,
  getNftContractAddresses,
  init,
  proxy,
  poll,
  processLifts,
  query,
  RELAYER_ADDRESS,
  signPaymentInfo,
  setSendingFailedStatus,
  getPayerPaymentNonce,
  generateSplitFeePaymentInfo,
};