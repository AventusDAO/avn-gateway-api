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
const payer = require('./db/entity/payer');
const { min } = require('lodash');
const BN = require('bn.js');

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
      message: `${requestId} - Creating batch transactions.`,
      extrinsic: params.map(p => `api.tx.${p.palletName}.proxy`).join(', ')
    });

    const innerCalls = params.map(p => {
      let innerCall = api.tx[p.palletName][p.method](...p.params.proxyParams);
      return api.tx.avnProxy.proxy(innerCall, p.params.paymentInfo);
    });

    const txn = api.tx.utility.batchAll(innerCalls);
    const result = await signAndSend(requestId, params[0].params.relayerAddress, txn);

    if (params[0].params.splitFeePayerAddress) {
      await setNextPayerNonce(requestId, params[0].params.splitFeePayerAddress, parseInt(params[0].params.paymentNonce) + 1);
    }

    return result;
  } else {
    log.trace(`${requestId} - Creating inner call from extrinsic api.tx.${palletName}.${method}`);

    const innerCall = api.tx[palletName][method](...params.proxyParams);
    const txn = api.tx.avnProxy.proxy(innerCall, params.paymentInfo);
    const result = await signAndSend(requestId, params.relayerAddress, txn);

    if (params.splitFeePayerAddress) {
      await setNextPayerNonce(requestId, params.splitFeePayerAddress, parseInt(params.paymentNonce) + 1);
    }

    return result;
  }
}

async function setNextPayerNonce(requestId, payerAddress, nonce) {
  log.trace(`${requestId} - Updating payment nonce for ${payerAddress} to ${nonce}`);
  try {
    await redis.setNextPayerNonce(payerAddress, nonce);
    log.trace(`${requestId} - Payment nonce updated`);
  } catch (err) {
    log.error({ message: `${requestId} - Error updating payment nonce`, err });
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
      log.warn(`${requestId} - No transaction found.`);
      return { status: `Transaction not found` };
    }

    const eventArgs = tx.eventArgs ? JSON.parse(tx.eventArgs) : {};

    return {
      txHash,
      status: tx.status,
      blockNumber: tx.blockNumber,
      transactionIndex: tx.transactionIndex,
      senderNonce: tx.senderNonce,
      eventArgs
    };
  } catch (err) {
    log.error({ message: `${requestId} - Error getting transaction status`, err });
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
    await setChainInfo();
    chainInfo = await redis.getChainInfo();
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

async function ethereumEventStatus(transactionHash) {
  const liftStatusesEnum = {
    AWAITING_TO_RECEIVE: 'AwaitingToReceive',
    UNCHECKED_LIFT: 'UncheckedLift',
    PENDING_VALIDATION: 'PendingValidation',
    LIFT_PROCESSED: 'LiftProcessed',
    LIFT_NOT_FOUND: 'LiftNotFound'
  };

  const { avnContract } = await getChainInfo();
  const { liftEvents } = await ethereum.getLiftEvents(avnContract);

  const liftEvent = liftEvents.find(liftEvent => liftEvent[1] === transactionHash);

  let liftStatus = liftStatusesEnum.LIFT_NOT_FOUND;

  if (!liftEvent) {
    return {
      transactionHash,
      liftStatus
    };
  }

  await api.queryMulti(
    [api.query.ethereumEvents.uncheckedEvents, api.query.ethereumEvents.eventsPendingChallenge],
    ([uncheckedEvents, eventsPendingChallenge]) => {
      if (uncheckedEvents.find(t => t.toJSON()[0].transactionHash === transactionHash)) {
        liftStatus = liftStatusesEnum.UNCHECKED_LIFT;
      }
      if (eventsPendingChallenge.find(t => t.toJSON()[0].transactionHash === transactionHash)) {
        liftStatus = liftStatusesEnum.PENDING_VALIDATION;
      }
    }
  );

  if (liftStatus !== liftStatusesEnum.LIFT_NOT_FOUND) {
    return {
      transactionHash,
      liftStatus
    };
  }

  const isProcessed = await api.query.ethereumEvents.processedEvents(liftEvent);
  if (isProcessed) {
    liftStatus = liftStatusesEnum.LIFT_PROCESSED;
    return {
      transactionHash,
      liftStatus
    };
  }

  return {
    transactionHash,
    liftStatus: liftStatusesEnum.AWAITING_TO_RECEIVE
  };
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
  log.trace(`${requestId} - Sending transaction to the AvN`);
  try {
    log.trace(`${requestId} - Relayer address: ${relayerAddress}`);
    relayerAccount = await getRelayerAccount(relayerAddress);
  } catch (err) {
    log.error({ message: `${requestId} - Error getting relayer account for ${relayerAddress}`, err });
    throw err;
  }

  log.trace(`${requestId} - encodedTransaction: ${txn.toString()}`);

  try {
    nonce = await redis.getNextNonce(relayerAddress);
    if (nonce === undefined) nonce = (await api.rpc.system.accountNextIndex(relayerAddress)).toNumber();
    const signedTx = await txn.signAsync(relayerAccount, { nonce: nonce.toString() });
    const receipt = await signedTx.send();
    await redis.setNextNonce(relayerAddress, nonce + 1);

    transactionHash = receipt.toString();
    await redis.updateTransactionStatusToPending(requestId, transactionHash, relayerAddress, nonce.toString());

    log.trace(`${requestId} - Transaction sent using relayer nonce: ${nonce}, transaction hash: ${transactionHash}`);
  } catch (err) {
    transactionHash = keccakAsHex(requestId);
    log.error({
      message: `${requestId} - Failed sending transaction using relayer nonce: ${nonce}, transaction hash: ${transactionHash}`,
      err
    });

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
  if (!requestId) throw new Error('setSendingFailedStatus - RequestId is mandatory');
  const failureReason = redis.transactionStatus[failure];

  if (!failureReason) throw new Error('Invalid failure reason: ', failure);

  await redis.addFailedAvnTransaction(requestId, keccakAsHex(requestId), undefined, undefined, failureReason);
}

async function addNewTransaction(requestId) {
  if (!requestId) throw new Error('addNewTransaction - RequestId is mandatory');
  const requestIdHash = keccakAsHex(requestId);

  log.trace(`${requestId} - Adding a new transaction. txHash: ${requestIdHash}`);
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
  const paymentInfoContext = stringToHex('authorization for proxy payment');
  const messageWithoutPrefix = '0x' + message.slice(4);

  // Important: we only want to sign correctly formatted payment data.
  if (!message || !messageWithoutPrefix.startsWith(paymentInfoContext)) throw new Error('Invalid data to sign.');
  return await vault.payerSign(message, payerUsername);
}

async function init() {
  vault = new Vault(config.vault.vault_url, config.vault.app_role_id, config.vault.app_secret_id);
  await connectToAvN();
  await setChainInfo();
}

async function setChainInfo() {
  const chainInfo = {
    name: await api.rpc.system.chain(),
    version: api.runtimeVersion.specVersion.toString(),
    avtContract: await api.query.tokenManager.avtTokenContract(),
    avnContract: await api.query.ethereumEvents.liftingContractAddress()
  };
  await redis.setChainInfo(chainInfo);
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

async function getPayerPaymentNonce(requestId, payerAddress) {
  try {
    let nonce = await redis.getNextPayerNonce(payerAddress);
    if (!nonce) {
      nonce = (await api.query.avnProxy.paymentNonces(payerAddress)).toNumber();
      log.trace(`${requestId} - Nonce expired, refreshing from chain. New nonce: ${nonce}`);
    }
    log.trace(`${requestId} - Payer ${payerAddress}, payment nonce: ${nonce}`);
    return nonce;
  } catch (err) {
    log.error({ message: `${requestId} - Error getting payer (${payerAddress}) payment nonce`, err });

    throw err;
  }
}

async function generateSplitFeePaymentInfo(requestId, transaction, paymentNonce) {
  log.trace(
    `${requestId} - Generating payment info. Payer: ${transaction.splitFeePayerAddress}, nonce: ${paymentNonce}, amount: ${transaction.relayerFees}`
  );

  const encodedPaymentParams = fees.encodePaymentParams(
    transaction.relayerAddress,
    transaction.relayerFees,
    paymentNonce,
    transaction.splitFeeProxyProof
  );

  const payerUserName = fees.getPayerVaultUsername(transaction.splitFeePayerVaultId);
  const signedData = await signPaymentInfo(u8aToHex(encodedPaymentParams), payerUserName);

  return {
    payer: transaction.splitFeePayerAddress,
    recipient: transaction.relayerAddress,
    amount: transaction.relayerFees,
    signature: {
      Sr25519: signedData.signature
    }
  };
}

function toBnString(val) {
  return typeof val === 'number' || !isHex(val) ? new BN(val).toString() : new BN(val.replace('0x', ''), 16).toString();
}

async function payerHasFunds(payerAddress) {
  const avtPayerBalance = await this.query('system', 'account', [payerAddress]);

  console.log(`PAYER AVT QUERY BALANCE ${JSON.stringify(avtPayerBalance, null, 2)}`);

  const avtBalance = new BN(toBnString(avtPayerBalance.data.free));

  console.log(`PAYER AVT BALANCE FORMATED ${JSON.stringify(avtBalance, null, 2)}`);

  const minAvtBalance = new BN(config.minimumPayerBalance);
  console.log(`MIN AVT BALANCE ${JSON.stringify(minAvtBalance, null, 2)}`);

  if (avtBalance.lt(minAvtBalance)) {
    // log the pk of the payer, how much they currently have, how much we expect them to have to be valid
    log.warn(`Not enough payer balance`);
    return false;
  } else {
    console.log('PAYER BALANCE IS HIGHER THAN MIN BALANCE');
  }
  return true;
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
  ethereumEventStatus,
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
  payerHasFunds
};
