import '@polkadot/api-augment';
import { ApiPromise, WsProvider, Keyring } from '@polkadot/api';
import { hexToU8a, isHex, stringToHex, u8aToHex } from '@polkadot/util';
import { keccakAsHex } from '@polkadot/util-crypto';
const config = require('multiconfig').load();
import redis, { TransactionStatus } from './redis';
import tier1 from './tier1';
import Vault from './vaultApp';
import stakingHelper from './stakingHelper';
import webhooks from './webhooks';
import fees from './paymentInfoHelper';
import rds from './db/index';
import BN from 'bn.js';
import logger from './logger';
import { Option } from '@polkadot/types';
import {
  Era,
  BatchInfo,
  NftInfo,
  Nft,
  liftStatus,
  accountInfo,
  LiftStatuses,
  PollResult,
  TxNotFoundResult,
  PollErrorResult,
  AccountInfo,
  AccountInfoNonStaking,
  UnprocessedLifts,
  EthereumEventStatus,
  GatewayUserInfo,
  ChainSummary
} from './types';

const AVN_URL = config.avnUrl;
const RELAYER_ADDRESS = config.relayer.address;
const RELAYER_VAULT_USERNAME_PREFIX = 'GatewayRelayer_';
const VOW_MODE = config.vowMode === 'true';

let api: ApiPromise, vault: Vault;
let relayers: Record<string, any> = {};

async function query(
  palletName: string,
  storageName: string,
  params: any[]
): Promise<string> {
  let result;

  if (params[0] === 'entries') {
    result = await api.query[palletName][storageName].entries();
  } else if (params[0] === 'keys') {
    result = await api.query[palletName][storageName].keys();
  } else if (params[0] === 'at') {
    const blockHash = await api.rpc.chain.getBlockHash(params[1]);
    result = await api.query[palletName][storageName].at(
      blockHash,
      ...params.slice(2)
    );
    result = result.toJSON();
  } else {
    result = await api.query[palletName][storageName](...params);
    result = result.toJSON();
  }

  logger.info(`Encoded query response: ${JSON.stringify(result)}`);
  return JSON.stringify(result);
}

async function proxy(
  requestId: string,
  palletName: string,
  method: string,
  params: any
): Promise<any> {
  if (palletName === 'utility' && method === 'batchAll') {
    logger.info({
      message: `${requestId} - Creating batch transactions.`,
      extrinsic: params
        .map((p: any) => `api.tx.${p.palletName}.proxy`)
        .join(', ')
    });

    const innerCalls = params.map((p: any) => {
      let innerCall = api.tx[p.palletName][p.method](...p.params.proxyParams);
      return api.tx.avnProxy.proxy(innerCall, p.params.paymentInfo);
    });

    const txn = api.tx.utility.batchAll(innerCalls);
    const payerAddress =
      params[0].params && params[0].params.splitFeePayerAddress;
    const result = await signAndSend(
      requestId,
      params[0].params.relayerAddress,
      txn,
      payerAddress
    );

    if (payerAddress) {
      await setNextPayerNonce(
        requestId,
        payerAddress,
        Number(params[0].params.paymentNonce) + 1
      );
      const eventType = webhooks.WEBHOOK_EVENT_TYPES.tx_sent;
      webhooks.publishEvent({
        eventType,
        requestId,
        accountId: payerAddress,
        data: result
      });
    }

    return result;
  } else {
    logger.info(
      `${requestId} - Creating inner call from extrinsic api.tx.${palletName}.${method}`
    );

    const innerCall = api.tx[palletName][method](...params.proxyParams);
    const txn = api.tx.avnProxy.proxy(innerCall, params.paymentInfo);
    const payerAddress = params && params.splitFeePayerAddress;
    const result = await signAndSend(
      requestId,
      params.relayerAddress,
      txn,
      payerAddress
    );

    if (payerAddress) {
      await setNextPayerNonce(
        requestId,
        payerAddress,
        Number(params.paymentNonce) + 1
      );
      const eventType = webhooks.WEBHOOK_EVENT_TYPES.tx_sent;
      webhooks.publishEvent({
        eventType,
        requestId,
        accountId: payerAddress,
        data: result
      });
    }

    return result;
  }
}

async function setNextPayerNonce(
  requestId: string,
  payerAddress: string,
  nonce: number
): Promise<void> {
  logger.info(
    `${requestId} - Updating payment nonce for ${payerAddress} to ${nonce}`
  );
  try {
    await redis.setNextPayerNonce(payerAddress, nonce);
    logger.info(`${requestId} - Payment nonce updated`);
  } catch (err) {
    logger.error({
      message: `${requestId} - Error updating payment nonce`,
      err
    });
  }
}

async function poll(
  requestId: string
): Promise<PollResult | PollErrorResult | TxNotFoundResult> {
  if (!requestId) {
    logger.error(`Unknown request: ${requestId}`);
    return { error: 'Bad request' };
  }

  try {
    let txHash = isTransactionHash(requestId)
      ? requestId
      : await redis.getTransactionHashByRequestId(requestId);
    let tx = await redis.getAvnTransaction(txHash);

    if (!tx) {
      logger.warn(`${requestId} - No transaction found.`);
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
    logger.error({
      message: `${requestId} - Error getting transaction status`,
      err
    });
    throw new Error(
      `Unable to get transaction status for requestId: ${requestId}`
    );
  }
}

async function getAccountInfo(
  accountId: string
): Promise<AccountInfo | AccountInfoNonStaking> {
  const balancesAll = await api.derive.balances.all(accountId);

  if (VOW_MODE) {
    return {
      totalBalance: balancesAll.freeBalance
        .add(balancesAll.reservedBalance)
        .toString(),
      freeBalance: balancesAll.availableBalance.toString()
    };
  }

  const currentEra = (await api.query.parachainStaking.era()).toJSON() as Era;
  const currentEraIndex = currentEra.current;

  const collators = await getCollatorsToNominate();
  let stakedBalance, unlockedBalance, unstakedBalance;

  if (
    collators.some((c: string) => c.toLowerCase() === accountId.toLowerCase())
  ) {
    const rawCandidateInfo =
      await api.query.parachainStaking.candidateInfo(accountId);
    const candidateInfo = rawCandidateInfo as any;

    ({ stakedBalance, unlockedBalance, unstakedBalance } =
      stakingHelper.calculateCollatorStakingBalances(
        candidateInfo,
        currentEraIndex
      ));
  } else {
    const rawNominatorState =
      await api.query.parachainStaking.nominatorState(accountId);
    const nominatorState = rawNominatorState as unknown as Option<any>;
    const allRequests =
      await api.query.parachainStaking.nominationScheduledRequests.multi(
        collators
      );

    const rawNominatorRequests = allRequests
      .flat()
      .filter((req: any) => req.nominator.eq(accountId));
    const nominatorRequests = rawNominatorRequests as any;
    ({ stakedBalance, unlockedBalance, unstakedBalance } =
      stakingHelper.calculateNominatorStakingBalances(
        nominatorState,
        nominatorRequests,
        currentEraIndex
      ));
  }

  return {
    totalBalance: balancesAll.freeBalance
      .add(balancesAll.reservedBalance)
      .toString(),
    freeBalance: balancesAll.availableBalance.toString(),
    stakedBalance: stakedBalance.toString(),
    unlockedBalance: unlockedBalance.toString(),
    unstakedBalance: unstakedBalance.toString()
  };
}

async function getCollatorsToNominate(): Promise<any[]> {
  if (VOW_MODE) {
    return [];
  }

  let collators = await redis.getCollatorsToNominate();

  if (collators === null) {
    collators = await api.query.parachainStaking.selectedCandidates();
    await redis.setCollatorsToNominate(collators);
  }

  return collators;
}

async function getStakingStats(): Promise<any> {
  if (VOW_MODE) {
    return {};
  }

  let stakingStats = await redis.getStakingStats();
  if (stakingStats === null) {
    const [
      minUserBond,
      maxNominatorsRewardedPerValidator,
      rawTotalStaked,
      stakersData
    ] = await Promise.all([
      api.query.parachainStaking.minTotalNominatorStake(),
      api.consts.parachainStaking.maxTopNominationsPerCandidate,
      api.query.parachainStaking.total(),
      api.query['parachainStaking']['nominatorState'].keys()
    ]);

    const totalStaked = toBn(rawTotalStaked.toJSON());
    const numActiveStakes = stakersData.length;
    const averageStaked = totalStaked.divn(numActiveStakes).toString();
    stakingStats = {
      totalStaked: totalStaked.toString(),
      minUserBond: minUserBond.toString(),
      maxNominatorsRewardedPerValidator:
        maxNominatorsRewardedPerValidator.toString(),
      totalStakers: stakersData.length,
      averageStaked: averageStaked
    };
    await redis.setStakingStats(stakingStats);
  }
  return stakingStats;
}

async function getChainInfo(): Promise<any> {
  let chainInfo = await redis.getChainInfo();
  if (chainInfo === null) {
    await setChainInfo();
    chainInfo = await redis.getChainInfo();
  }
  return chainInfo;
}

async function getCurrentBlock(): Promise<string> {
  return (await api.derive.chain.bestNumberFinalized()).toString();
}

async function getTotalToken(token: string): Promise<string> {
  token = token.toLowerCase();
  let total = await redis.getTotalToken(token);

  if (!total) {
    const chainInfo = await getChainInfo();

    if (token === chainInfo.avtContract.toLowerCase()) {
      total = (await api.query.balances.totalIssuance()).toString();
    } else {
      total = await tier1.getLockedBalance(chainInfo.avnContract, token);
    }

    await redis.setTotalToken(token, total);
  }

  return total;
}

async function ethereumEventStatus(
  transactionHash: string
): Promise<EthereumEventStatus> {
  const { avnContract } = await getChainInfo();
  const { liftEvents } = await tier1.getLiftEvents(avnContract);

  const liftEvent = liftEvents.find(
    (liftEvent: any) => liftEvent[1] === transactionHash
  );

  let liftStatus = LiftStatuses.LIFT_NOT_FOUND;

  if (!liftEvent) {
    return {
      transactionHash,
      liftStatus
    };
  }

  await api.queryMulti(
    [
      api.query.ethereumEvents.uncheckedEvents,
      api.query.ethereumEvents.eventsPendingChallenge
    ],
    ([rawUncheckedEvents, rawEventsPendingChallenge]) => {
      let uncheckedEvents = rawUncheckedEvents.toJSON() as any;
      if (
        uncheckedEvents.find(
          (t: any) => t.toJSON()[0].transactionHash === transactionHash
        )
      ) {
        liftStatus = LiftStatuses.UNCHECKED_LIFT;
      }
      let eventsPendingChallenge = rawEventsPendingChallenge.toJSON() as any;
      if (
        eventsPendingChallenge.find(
          (t: any) => t.toJSON()[0].transactionHash === transactionHash
        )
      ) {
        liftStatus = LiftStatuses.PENDING_VALIDATION;
      }
    }
  );

  if (liftStatus !== LiftStatuses.LIFT_NOT_FOUND) {
    return {
      transactionHash,
      liftStatus
    };
  }

  const isProcessed = await api.query.ethereumEvents.processedEvents(liftEvent);
  if (isProcessed) {
    liftStatus = LiftStatuses.LIFT_PROCESSED;
    return {
      transactionHash,
      liftStatus
    };
  }

  return {
    transactionHash,
    liftStatus: LiftStatuses.AWAITING_TO_RECEIVE
  };
}

async function getUnprocessedLifts(): Promise<UnprocessedLifts> {
  let unprocessedLifts: string[] = [];
  try {
    const { avnContract } = await getChainInfo();
    const { fromBlock, toBlock, liftEvents } =
      await tier1.getLiftEvents(avnContract);

    if (liftEvents.length > 0) {
      const liftStatuses =
        await api.query.ethereumEvents.processedEvents.multi(liftEvents);

      for (let [i, rawIsProcessed] of liftStatuses.entries()) {
        const isProcessed = rawIsProcessed.toJSON();
        if (isProcessed !== true) {
          unprocessedLifts.push(liftEvents[i][1]);
        }
      }
    }

    if (unprocessedLifts.length === 0) {
      const lastT1BlockChecked = await redis.getLiftsFromTier1Block();
      if (toBlock >= lastT1BlockChecked) {
        await redis.setLiftsFromTier1Block(Number(toBlock) + 1);
      }
    }

    logger.debug(
      `returning unprocessedLifts: ${JSON.stringify(unprocessedLifts, null, 2)}`
    );
    return { fromBlock, toBlock, unprocessedLifts };
  } catch (error) {
    logger.error(`Error getting unprocessed lifts: `, error);
    throw error;
  }
}

async function processLifts(
  requestId: string,
  toBlock: number,
  unprocessedLifts: string[]
): Promise<any> {
  const liftEventType = 1;
  const calls = unprocessedLifts.map(txHash =>
    api.tx.ethereumEvents.addEthereumLog(liftEventType, txHash)
  );
  const txn = api.tx.utility.batch(calls);
  let result;
  try {
    result = await signAndSend(requestId, RELAYER_ADDRESS, txn);
    const lastT1BlockChecked = await redis.getLiftsFromTier1Block();
    // extra safety to prevent resetting the last checked block
    if (toBlock >= lastT1BlockChecked) {
      await redis.setLiftsFromTier1Block(Number(toBlock) + 1);
    }
  } catch (err) {
    result = err;
  }
  return result;
}

//This function can be called multiple times (3 by default) from sqsConsumer, for the same transaction if it returns an error.
async function signAndSend(
  requestId: string,
  relayerAddress: string,
  txn: any,
  optionalAccountForWebhook?: string
): Promise<any> {
  let transactionHash, nonce, relayerAccount;
  logger.info(`${requestId} - Sending transaction to the AvN`);
  try {
    logger.info(`${requestId} - Relayer address: ${relayerAddress}`);
    relayerAccount = await getRelayerAccount(relayerAddress);
  } catch (err) {
    logger.error({
      message: `${requestId} - Error getting relayer account for ${relayerAddress}`
    });
    logger.error(err);

    if (optionalAccountForWebhook) {
      const data = {
        status: 'failed',
        reason: `invalid relayer: ${relayerAddress}`
      };
      const eventType = webhooks.WEBHOOK_EVENT_TYPES.tx_send_failed;
      webhooks.publishEvent({
        eventType,
        requestId,
        accountId: optionalAccountForWebhook,
        data
      });
    }

    throw err;
  }

  logger.info(`${requestId} - encodedTransaction: ${txn.toString()}`);

  try {
    nonce = await redis.getNextNonce(relayerAddress);
    if (nonce === null)
      nonce = (
        await api.rpc.system.accountNextIndex(relayerAddress)
      ).toNumber();
    const signedTx = await txn.signAsync(relayerAccount, {
      nonce: nonce.toString()
    });
    const receipt = await signedTx.send();
    await redis.setNextNonce(relayerAddress, nonce + 1);

    transactionHash = receipt.toString();
    await redis.updateTransactionStatusToPending(
      requestId,
      transactionHash,
      relayerAddress,
      nonce.toString()
    );

    logger.info(
      `${requestId} - Transaction sent using relayer nonce: ${nonce}, transaction hash: ${transactionHash}`
    );
  } catch (err) {
    transactionHash = keccakAsHex(requestId);
    logger.error({
      message: `${requestId} - Failed sending transaction using relayer nonce: ${nonce}, transaction hash: ${transactionHash}`,
      err
    });

    if (optionalAccountForWebhook) {
      const data = { status: 'failed', reason: `nonce`, transactionHash };
      const eventType = webhooks.WEBHOOK_EVENT_TYPES.tx_send_failed;
      webhooks.publishEvent({
        eventType,
        requestId,
        accountId: optionalAccountForWebhook,
        data
      });
    }

    await redis.addFailedAvnTransaction(
      requestId,
      transactionHash,
      relayerAddress,
      nonce?.toString(),
      TransactionStatus.SendingFailed
    );

    throw err;
  }

  return { transactionHash };
}

async function setSendingFailedStatus(
  requestId: string,
  failureReason: string
): Promise<void> {
  if (!requestId)
    throw new Error('setSendingFailedStatus - RequestId is mandatory');
  await redis.addFailedAvnTransaction(
    requestId,
    keccakAsHex(requestId),
    undefined,
    undefined,
    failureReason
  );
}

async function addNewTransaction(requestId: string): Promise<void> {
  if (!requestId) throw new Error('addNewTransaction - RequestId is mandatory');
  const requestIdHash = keccakAsHex(requestId);

  logger.info(
    `${requestId} - Adding a new transaction. txHash: ${requestIdHash}`
  );
  await redis.addNewAvnTransaction(requestId, requestIdHash);
}

async function getRelayerAccount(relayerAddress: string): Promise<any> {
  if (!relayers[relayerAddress]) {
    const userName =
      RELAYER_VAULT_USERNAME_PREFIX +
      (await rds.getRelayerVaultId(relayerAddress));
    let relayerSuri = await vault.getRelayerSeed(userName);

    if (!relayerSuri) {
      logger.warn(
        `Relayer with username: ${userName} not found in vault. Trying with address ${relayerAddress} as username`
      );
      relayerSuri = await vault.getRelayerSeed(relayerAddress);
      if (!relayerSuri) {
        throw new Error(
          `Relayer username: ${userName}, address: ${relayerAddress} not found in Vault.`
        );
      }
    }
    relayers[relayerAddress] = createAccount(relayerSuri);
  }
  return relayers[relayerAddress];
}

async function getNftContractAddresses(): Promise<string> {
  const data = await api.query.ethereumEvents.nftT1Contracts.entries();
  return JSON.stringify(
    data.map(([key, _]) => key.args.map((k: any) => k.toHuman())).flat()
  );
}

async function getGatewayUserInfo(account: string): Promise<GatewayUserInfo> {
  const result = await api.queryMulti([
    [api.query.avnProxy.paymentNonces, account],
    [api.query.system.account, account]
  ]);

  const [paymentNonce, accountInfo] = result;
  let balance = (accountInfo.toJSON() as unknown as accountInfo).data;

  return {
    paymentNonce: paymentNonce.toString(),
    freeBalance: balance.free.toString()
  };
}

async function signPaymentInfo(
  message: string,
  payerUsername: string
): Promise<any> {
  const paymentInfoContext = stringToHex(fees.FEE_PAYMENT_CONTEXT);
  const messageWithoutPrefix = '0x' + message.slice(4);

  // Important: we only want to sign correctly formatted payment data.
  if (!message || !messageWithoutPrefix.startsWith(paymentInfoContext))
    throw new Error('Invalid data to sign.');
  return await vault.payerSign(message, payerUsername);
}

async function init(): Promise<void> {
  vault = new Vault(
    config.vault.vault_url,
    config.vault.app_role_id,
    config.vault.app_secret_id
  );
  await connectToAvN();
  await setChainInfo();
  await startSubscriptions();
}

async function startSubscriptions(): Promise<void> {
  if (VOW_MODE) {
    return;
  }
  // variable name for descriptive porpuses if we add more subscriptions
  const selectedCandidatesSub =
    await api.query.parachainStaking.selectedCandidates((candidates: any) => {
      logger.info(`Setting collators to nominate: ${candidates}`);
      redis.setCollatorsToNominate(candidates);
    });
}

async function setChainInfo(): Promise<void> {
  // TODO: Remove defaulting to the old "liftingContractAddress" once the chain has been upgraded in all environments
  let avnContract;
  try {
    avnContract = await api.query.avn.avnBridgeContractAddress();
  } catch {
    avnContract = await api.query.ethereumEvents.liftingContractAddress();
  }

  const chainInfo = {
    name: await api.rpc.system.chain(),
    version: api.runtimeVersion.specVersion.toString(),
    avtContract: await api.query.tokenManager.avtTokenContract(),
    avnContract
  };
  await redis.setChainInfo(chainInfo);
}

async function connectToAvN(): Promise<void> {
  logger.info(`Creating a connection to the AVN on: ${AVN_URL}`);

  const provider = new WsProvider(AVN_URL);
  api = await ApiPromise.create({ provider });

  const [chain, nodeName, nodeVersion] = await Promise.all([
    api.rpc.system.chain(),
    api.rpc.system.name(),
    api.rpc.system.version()
  ]);

  logger.info(
    `You are connected to chain ${chain} (${AVN_URL}) using ${nodeName} v${nodeVersion}\n`
  );
}

function createAccount(suri: string): any {
  const keyring = new Keyring({ type: 'sr25519' });
  return keyring.addFromUri(suri);
}

function isTransactionHash(requestId: string): boolean {
  return isHex(requestId) && requestId.length === 66;
}

async function getPayerPaymentNonce(
  requestId: string,
  payerAddress: string
): Promise<number> {
  try {
    let nonce = await redis.getNextPayerNonce(payerAddress);
    if (!nonce) {
      let rawNonce = await api.query.avnProxy.paymentNonces(payerAddress);
      nonce = rawNonce.toJSON() as number;
      logger.info(
        `${requestId} - Nonce expired, refreshing from chain. New nonce: ${nonce}`
      );
    }
    logger.info(
      `${requestId} - Payer ${payerAddress}, payment nonce: ${nonce}`
    );
    return nonce;
  } catch (err) {
    logger.error({
      message: `${requestId} - Error getting payer (${payerAddress}) payment nonce`,
      err
    });
    throw err;
  }
}

async function generateSplitFeePaymentInfo(
  requestId: string,
  transaction: any,
  paymentNonce: number,
  currencyToken: string
): Promise<any> {
  logger.info(
    `${requestId} - Generating payment info. Payer: ${transaction.splitFeePayerAddress}, nonce: ${paymentNonce}, amount: ${transaction.relayerFees}`
  );

  const encodedPaymentParams = fees.encodePaymentParams(
    transaction.relayerAddress,
    transaction.relayerFees,
    paymentNonce,
    transaction.splitFeeProxyProof,
    currencyToken
  );

  const payerUserName = fees.getPayerVaultUsername(
    transaction.splitFeePayerVaultId
  );
  const signedData = await signPaymentInfo(
    u8aToHex(encodedPaymentParams),
    payerUserName
  );

  return {
    payer: transaction.splitFeePayerAddress,
    recipient: transaction.relayerAddress,
    amount: transaction.relayerFees,
    token: currencyToken,
    signature: {
      Sr25519: signedData.signature
    }
  };
}

async function payerHasFunds(payerAddress: string): Promise<boolean> {
  const result = await query('system', 'account', [payerAddress]);
  const payerAvtBalance = toBn(JSON.parse(result).data.free);
  const minAvtBalance = toBn(config.minimumPayerBalance);

  if (payerAvtBalance.lt(minAvtBalance)) {
    logger.warn(
      `Insufficient payer balance: - Payer: ${payerAddress} - Current payer balance: ${payerAvtBalance.toString()} - Minimum payer balance: ${minAvtBalance.toString()}`
    );
    return false;
  }
  return true;
}

function toBn(val: any): BN {
  return typeof val === 'number' || !isHex(val)
    ? new BN(val)
    : new BN(val.replace('0x', ''), 16);
}

async function getLowerProof(lowerId: number): Promise<string | null> {
  const rawProof = await api.query.tokenManager.lowersReadyToClaim(lowerId);
  let proof = rawProof.toJSON() as any;
  return proof?.encodedLowerData ?? null;
}

async function getUnclaimedLowerProofs(
  minLowerId: number,
  additionalLowerIds: number[]
): Promise<Record<number, string>> {
  try {
    let entries = [],
      startKey: any,
      unclaimedLowerIds: number[] = [],
      claimData: any[] = [];

    do {
      entries = await api.query.tokenManager.lowersReadyToClaim.keysPaged({
        pageSize: 1000,
        args: [],
        startKey
      });
      if (entries.length > 0) {
        startKey = entries[entries.length - 1];
        const filteredIds = entries
          .map(({ args: [lowerId] }) => lowerId.toJSON() as number)
          .filter(
            lowerId =>
              lowerId > minLowerId || additionalLowerIds.includes(lowerId)
          );

        unclaimedLowerIds = unclaimedLowerIds.concat(filteredIds);

        const batchClaimData =
          await api.query.tokenManager.lowersReadyToClaim.multi(filteredIds);
        claimData = claimData.concat(batchClaimData);
      }
    } while (entries.length > 0);

    return claimData.reduce((acc, data, index) => {
      const lowerId = unclaimedLowerIds[index];
      acc[lowerId] = data.toHuman().encodedLowerData;
      return acc;
    }, {});
  } catch (error) {
    logger.error('Error in getUnclaimedLowerProofs:', error);
    throw error;
  }
}

async function regenerateLowerProof(
  account: any,
  lowerId: number
): Promise<any> {
  const txn = api.tx.tokenManager.regenerateLowerProof(lowerId);
  return await txn.signAndSend(account, { nonce: -1 });
}

async function getNftInfo(nftId: number): Promise<NftInfo | null> {
  try {
    const nft = (
      await api.query.nftManager.nfts(nftId)
    ).toJSON() as Partial<Nft>;
    if (!nft) {
      return null;
    }

    const nftInfo = (
      await api.query.nftManager.nftInfos(nft.infoId)
    ).toJSON() as Partial<NftInfo>;
    return {
      ownerAddress: nft.owner,
      nonce: nft.nonce,
      infoId: nft.infoId,
      uniqueExternalRef: nft.uniqueExternalRef,
      royalties: nftInfo.royalties?.map((r: any) => {
        return {
          recipient_t1_address: r.recipientT1Address,
          rate: { parts_per_million: r.rate.partsPerMillion }
        };
      }),
      marketplaceId: nftInfo.t1Authority
    };
  } catch (err) {
    logger.error(`Error getting nft info for nftId: ${nftId}: `, err);
    throw err;
  }
}

async function getBatchInfo(batchId: number): Promise<BatchInfo | null> {
  try {
    const infoId = (
      await api.query.nftManager.batchInfoId(batchId)
    ).toJSON() as number;
    if (infoId <= 0) {
      return null;
    }

    const rawBatchInfo = await api.query.nftManager.nftInfos(infoId);
    const batchInfo = rawBatchInfo.toJSON() as Partial<BatchInfo>;
    return {
      ownerAddress: batchInfo.creator,
      infoId: batchInfo.infoId,
      totalSupply: batchInfo.totalSupply,
      royalties: batchInfo.royalties?.map((r: any) => {
        return {
          recipient_t1_address: r.recipientT1Address,
          rate: { parts_per_million: r.rate.partsPerMillion }
        };
      }),
      marketplaceId: batchInfo.t1Authority
    };
  } catch (err) {
    logger.error(`Error getting batch info for batchId: ${batchId}: `, err);
    throw err;
  }
}

async function predictionMarketConstants(): Promise<any> {
  logger.info('Getting prediction market constants');
  const [
    advisoryBond,
    validityBond,
    closeEarlyBlockPeriod,
    closeEarlyTimeFramePeriod,
    closeEarlyDisputeBond,
    closeEarlyProtectionTimeFramePeriod,
    closeEarlyProtectionBlockPeriod,
    closeEarlyRequestBond,
    disputeBond,
    maxDisputes,
    minDisputeDuration,
    maxDisputeDuration,
    maxCreatorFee,
    minCategories,
    maxCategories,
    outsiderBond,
    oracleBond,
    maxOracleDuration,
    minOracleDuration,
    maxGracePeriod,
    maxSwapFee,
  ] = await Promise.all([
    api.consts.predictionMarkets.advisoryBond,
    api.consts.predictionMarkets.validityBond,

    api.consts.predictionMarkets.closeEarlyBlockPeriod,
    api.consts.predictionMarkets.closeEarlyTimeFramePeriod,
    api.consts.predictionMarkets.closeEarlyDisputeBond,
    api.consts.predictionMarkets.closeEarlyProtectionTimeFramePeriod,
    api.consts.predictionMarkets.closeEarlyProtectionBlockPeriod,
    api.consts.predictionMarkets.closeEarlyRequestBond,

    api.consts.predictionMarkets.disputeBond,
    api.consts.predictionMarkets.maxDisputes,
    api.consts.predictionMarkets.minDisputeDuration,
    api.consts.predictionMarkets.maxDisputeDuration,

    api.consts.predictionMarkets.maxCreatorFee,
    api.consts.predictionMarkets.minCategories,
    api.consts.predictionMarkets.maxCategories,

    api.consts.predictionMarkets.outsiderBond,
    api.consts.predictionMarkets.oracleBond,
    api.consts.predictionMarkets.maxOracleDuration,
    api.consts.predictionMarkets.minOracleDuration,
    api.consts.predictionMarkets.maxGracePeriod,

    api.consts.neoSwaps.maxSwapFee,
  ]);

  let result: Record<string, string> = {};
  result['advisoryBond'] = advisoryBond.toString();
  result['validityBond'] = validityBond.toString();
  result['closeEarlyBlockPeriod'] = closeEarlyBlockPeriod.toString();
  result['closeEarlyTimeFramePeriod'] = closeEarlyTimeFramePeriod.toString();
  result['closeEarlyDisputeBond'] = closeEarlyDisputeBond.toString();
  result['closeEarlyProtectionTimeFramePeriod'] = closeEarlyProtectionTimeFramePeriod.toString();
  result['closeEarlyProtectionBlockPeriod'] = closeEarlyProtectionBlockPeriod.toString();
  result['closeEarlyRequestBond'] = closeEarlyRequestBond.toString();
  result['disputeBond'] = disputeBond.toString();
  result['maxDisputes'] = maxDisputes.toString();
  result['minDisputeDuration'] = minDisputeDuration.toString();
  result['maxDisputeDuration'] = maxDisputeDuration.toString();
  result['maxCreatorFee'] = maxCreatorFee.toString();
  result['minCategories'] = minCategories.toString();
  result['maxCategories'] = maxCategories.toString();
  result['outsiderBond'] = outsiderBond.toString();
  result['oracleBond'] = oracleBond.toString();
  result['maxOracleDuration'] = maxOracleDuration.toString();
  result['minOracleDuration'] = minOracleDuration.toString();
  result['maxGracePeriod'] = maxGracePeriod.toString();
  result['maxSwapFee'] = maxSwapFee.toString();

  return result;
}

const avn = {
  addNewTransaction,
  createAccount,
  getAccountInfo,
  getUnclaimedLowerProofs,
  getLowerProof,
  getCollatorsToNominate,
  getStakingStats,
  getChainInfo,
  getCurrentBlock,
  getGatewayUserInfo,
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
  payerHasFunds,
  regenerateLowerProof,
  getNftInfo,
  getBatchInfo,
  predictionMarketConstants,
};
export default avn;
