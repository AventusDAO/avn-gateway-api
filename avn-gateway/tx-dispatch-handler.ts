import {
  init, callWithTimeout, requestFailed, buildErrorBody, isValidCurrencyFormat, isValidProxySignature, axios, toBnString,
  isValidAccountId, getProxyProof, isValidSignatureFormat, isSplitFeeTransaction, isValidNonce,
  publishEvent, buildValidResponseBody, isValidString, isValidEthereumAddress, isValidNftId,
  isValidAmount, isValidEthereumTransactionHash, encodeRoyalties, convertToPublicKey,
  NONCE_INFO, WEBHOOK_EVENT_TYPES,
  isValidArray
} from '/opt/utils';
import * as fees from '/opt/paymentUtils';
import * as sqs from '/opt/sqsUtils';
import {
  StatusCode, CustomSQSHandler, ValidResponse,
  ProxyParams, ProxyProof, QueryParams, PublishEventData, NonceInfo,
  CallConfig, ProxyTransaction, ProxyCall
} from '/opt/handler-types';
import { ErrorBody, SendTxResult, SignDataItem } from '/opt/types';

// @ts-ignore
import { SQSEvent, Context, SQSBatchResponse, APIGatewayProxyResult } from 'aws-lambda';

const AVN_CONNECTOR_ENDPOINT: string = process.env.AVN_CONNECTOR_ENDPOINT || '';
const SQS_TX_QUEUE_URL: string = process.env.SQS_TX_QUEUE_URL || '';

export const handler: CustomSQSHandler = async (event: SQSEvent, context: Context): Promise<APIGatewayProxyResult | SQSBatchResponse> => {
  await init();
  let processedMessagesCount = 0;

  if (!event.Records) {
    console.info(`No messages to process.`);
    return {
      statusCode: StatusCode.OK,
      body: `No messages to process`
    };
  }

  console.info(`Processing ${event.Records.length} message(s) from queue`);

  try {
    for (let record of event.Records) {
      const result = await callWithTimeout(context.getRemainingTimeInMillis(), processRequest, [record.body]);
      if (requestFailed(result) === true) {
        console.error('Request failed:', result);
        break;
      }
      processedMessagesCount += 1;
    }

    if (processedMessagesCount < event.Records.length) {
      console.warn(`Processed ${processedMessagesCount} out of ${event.Records.length} message(s) successfully.`);
      return {
        batchItemFailures: sqs.getFailedMessagesForFifoQueue(event.Records, processedMessagesCount)
      };
    }

    return {
      statusCode: StatusCode.OK,
      body: `${event.Records.length} message(s) processed successfully.`
    };
  } catch (err) {
    console.error('Failed to process messages: ', err);
    return {
      batchItemFailures: sqs.getFailedMessagesForFifoQueue(event.Records, processedMessagesCount)
    };
  }
};

async function processRequest(request: string): Promise<ValidResponse | ErrorBody> {
  let call: ProxyCall;

  try {
    call = JSON.parse(request);
  } catch (err) {
    console.error('Parse error:', err);
    return buildErrorBody('parse', 'Failed to parse message as JSON', err.toString(), request, null);
  }

  const requestId = call.awsRequestId ?? '';
  if (!call.id) call.id = '';

  console.info(`Dispatching request: ${request}`);

  return validateAndProcessCall(call, request, requestId);
}

async function validateAndProcessCall(call: ProxyCall, request: string, requestId: string): Promise<ValidResponse | ErrorBody> {
  if (typeof call.method !== 'string') {
    console.error(`Invalid method type: Expected string, received ${typeof call.method}`);
    return buildErrorBody('request', 'Method type must be string', call.method, request, call.id);
  }

  try {
    return callSwitch(call, request, requestId);
  } catch (err) {
    console.error('Failed to process message from default queue:', err);
    return buildErrorBody('request', 'Failed to process message from default queue', err.toString(), request, call.id);
  }
}

async function callSwitch(call: ProxyCall, request: string, requestId: string): Promise<ValidResponse | ErrorBody> {
  console.info(`${requestId} - Processing call: ${call.method}, proxy nonce: ${(call.params || {}).nonce}`);


  if (callConfigs[call.method]) {
    return await processProxyCall(call.method, call, request, requestId);
  } else {
    return buildErrorBody('method', 'Method not found', call.method, request, call.id);
  }
}

async function processProxyCall(callType: string, call: ProxyCall, request: string, requestId: string): Promise<ValidResponse | ErrorBody> {
  const config = callConfigs[callType];
  if (!config) {
    throw new Error(`No configuration found for call type ${callType}`);
  }

  const { pallet, method, buildMethodParams, buildSignData } = config;

  if (config.nonceType) {
    let nonce = call.params.nonce ?? await queryNonce(requestId, NONCE_INFO[config.nonceType], call.params.user);
    call.params.nonce = nonce;
  }

  const methodParams = buildMethodParams(call.params);
  const signData = buildSignData({ ...call.params });

  try {
    validateSignData(signData);

    if (!isValidProxySignature(call.params.proxySignature, call.params.user, signData)) {
      throw 'proxySignature';
    }
  } catch (err) {
    console.error(`Error in processProxyCall:`, err);
    const badParamValue = err.toString();
    return buildErrorBody('params', `invalid ${badParamValue}`, badParamValue, request, call.id);
  }

  return await processProxyMethod(call, request, requestId, pallet, method, methodParams);
}

//TODO: Fix me. We should not read the nonce from the chain because we risk getting duplicate values for different tx's
async function queryNonce(requestId: string, nonceInfo: NonceInfo, nonceKey: string): Promise<string> {
  const { palletName, storageName } = nonceInfo;
  console.info(`${requestId} - Refreshing nonce from chain for ${palletName}.${storageName} - ${nonceKey}`);
  const params: QueryParams = { requestId, palletName, storageName, params: [nonceKey] };
  const result = await axios.post(`${AVN_CONNECTOR_ENDPOINT}avnQuery`, params);
  const nonce = storageName === 'nfts' ? toBnString(result.data.nonce) : toBnString(result.data);
  console.info(`${requestId} - new nonce: ${nonce}`);
  return nonce;
}

async function processProxyMethod(
  call: ProxyCall,
  request: string,
  requestId: string,
  pallet: string,
  method: string,
  methodParams: any[]
): Promise<ValidResponse | ErrorBody> {
  const { relayer, user, payer, proxySignature, currencyToken } = call.params;

  try {
    if (!isValidAccountId(relayer)) throw 'relayer';
    if (!isValidAccountId(user)) throw 'user';
    if (!isValidAccountId(payer)) throw 'payer';
    if (!isValidSignatureFormat(proxySignature)) throw 'proxySignature';
    if (!isValidCurrencyFormat(currencyToken)) throw 'currencyToken';

    if (!isSplitFeeTransaction(call)) {
      if (!isValidSignatureFormat(call.params.feePaymentSignature!)) throw 'feePaymentSignature';
      if (!isValidNonce(call.params.paymentNonce!)) throw 'paymentNonce';
    }
  } catch (param) {
    return buildErrorBody('params', `invalid proxy method ${param}: ${call.params[param]}`, param, request, call.id);
  }

  const proxyProof: ProxyProof = getProxyProof(user, relayer, proxySignature);

  const params: ProxyParams = {
    proxyParams: [proxyProof].concat(methodParams),
    relayerAddress: relayer,
    currencyToken: currencyToken
  };

  if (isSplitFeeTransaction(call)) {
    params.splitFeePayerAddress = call.splitFeePayerAddress!;
    params.splitFeePayerVaultId = call.splitFeePayerVaultId!;
    params.relayerFees = call.relayerFee!;
    params.splitFeeProxyProof = proxyProof;
    const eventType = WEBHOOK_EVENT_TYPES.tx_ready;
    await publishEvent(AVN_CONNECTOR_ENDPOINT, eventType, requestId, params.splitFeePayerAddress, {
      relayer,
      user,
      proxySignature,
      pallet,
      method,
      methodParams,
      currencyToken
    } as PublishEventData);
  } else {
    const paymentInfo = await fees.tryGetPaymentInfo(
      AVN_CONNECTOR_ENDPOINT,
      payer,
      relayer,
      call.params.feePaymentSignature!,
      call.method,
      call.params.paymentNonce!,
      proxyProof,
      currencyToken
    );

    params.paymentInfo = paymentInfo;
  }

  return await sendTx(call, request, requestId, pallet, method, params);
}

async function sendTx(
  call: ProxyCall,
  request: string,
  requestId: string,
  palletName: string,
  method: string,
  params: ProxyParams
): Promise<SendTxResult | ErrorBody> {
  try {
    const txType = 'avnProxy';
    const tx: ProxyTransaction = { requestId, txType, palletName, method, params };
    const result = await sqs.sendToQueue(SQS_TX_QUEUE_URL, tx);
    return buildValidResponseBody(call.id, result);
  } catch (err) {
    console.error('Failed to send proxy transaction:', err);
    return buildErrorBody('internal', 'failed to send proxy transaction', err.toString(), request, call.id);
  }
}

const typeValidationMap = {
  Text: isValidString,
  AccountId: isValidAccountId,
  H160: isValidEthereumAddress,
  u128: isValidAmount,
  H256: isValidEthereumTransactionHash,
  U256: isValidNftId,
  'Vec<u8>': isValidString,
  'Vec<LookupSource>': isValidArray
  // What about U8, U64, BalanceOf...?
};

const callConfigs: { [key: string]: CallConfig } = {
  'proxyAvtTransfer': {
    pallet: 'tokenManager',
    method: 'signedTransfer',
    nonceType: "token",
    buildMethodParams: ({ user, recipient, token, amount }) => [user, recipient, token, amount],
    buildSignData: ({ relayer, user, recipient, token, amount, nonce }) => [
      { Text: 'authorization for transfer operation' },
      { AccountId: relayer },
      { AccountId: user },
      { AccountId: recipient },
      { H160: token },
      { u128: amount },
      { u64: nonce }
    ]
  },
  'proxyTokenTransfer': {
    pallet: 'tokenManager',
    method: 'signedTransfer',
    nonceType: "token",
    buildMethodParams: ({ user, recipient, token, amount }) => [user, recipient, token, amount],
    buildSignData: ({ relayer, user, recipient, token, amount, nonce }) => [
      { Text: 'authorization for transfer operation' },
      { AccountId: relayer },
      { AccountId: user },
      { AccountId: recipient },
      { H160: token },
      { u128: amount },
      { u64: nonce }
    ]
  },
  'proxyConfirmTokenLift': {
    pallet: 'ethereumEvents',
    method: 'signedAddEthereumLog',
    nonceType: "confirmation",
    buildMethodParams: ({ eventType, ethereumTransactionHash }) => [eventType, ethereumTransactionHash],
    buildSignData: ({ relayer, eventType, ethereumTransactionHash, nonce }) => [
      { Text: 'authorization for add ethereum log operation' },
      { AccountId: relayer },
      { u8: eventType.toString() },
      { H256: ethereumTransactionHash },
      { u64: nonce }
    ]
  },
  'proxyMintEthereumBatchNft': {
    pallet: 'ethereumEvents',
    method: 'signedAddEthereumLog',
    nonceType: "confirmation",
    buildMethodParams: ({ eventType, ethereumTransactionHash }) => [eventType, ethereumTransactionHash],
    buildSignData: ({ relayer, eventType, ethereumTransactionHash, nonce }) => [
      { Text: 'authorization for add ethereum log operation' },
      { AccountId: relayer },
      { u8: eventType.toString() },
      { H256: ethereumTransactionHash },
      { u64: nonce }
    ]
  },
  'proxyTransferEthereumNft': {
    pallet: 'ethereumEvents',
    method: 'signedAddEthereumLog',
    nonceType: "confirmation",
    buildMethodParams: ({ eventType, ethereumTransactionHash }) => [eventType, ethereumTransactionHash],
    buildSignData: ({ relayer, eventType, ethereumTransactionHash, nonce }) => [
      { Text: 'authorization for add ethereum log operation' },
      { AccountId: relayer },
      { u8: eventType.toString() },
      { H256: ethereumTransactionHash },
      { u64: nonce }
    ]
  },
  'proxyCancelEthereumNftSale': {
    pallet: 'ethereumEvents',
    method: 'signedAddEthereumLog',
    nonceType: "confirmation",
    buildMethodParams: ({ eventType, ethereumTransactionHash }) => [eventType, ethereumTransactionHash],
    buildSignData: ({ relayer, eventType, ethereumTransactionHash, nonce }) => [
      { Text: 'authorization for add ethereum log operation' },
      { AccountId: relayer },
      { u8: eventType.toString() },
      { H256: ethereumTransactionHash },
      { u64: nonce }
    ]
  },
  'proxyEndEthereumBatchSale': {
    pallet: 'ethereumEvents',
    method: 'signedAddEthereumLog',
    nonceType: "confirmation",
    buildMethodParams: ({ eventType, ethereumTransactionHash }) => [eventType, ethereumTransactionHash],
    buildSignData: ({ relayer, eventType, ethereumTransactionHash, nonce }) => [
      { Text: 'authorization for add ethereum log operation' },
      { AccountId: relayer },
      { u8: eventType.toString() },
      { H256: ethereumTransactionHash },
      { u64: nonce }
    ]
  },
  'proxyTokenLower': {
    pallet: 'tokenManager',
    method: 'scheduleSignedLower',
    nonceType: "token",
    buildMethodParams: ({ user, token, t1Recipient, amount }) => [user, token, amount, t1Recipient],
    buildSignData: ({ relayer, user, token, amount, t1Recipient, nonce }) => [
      { Text: 'authorization for lower operation' },
      { AccountId: relayer },
      { AccountId: user },
      { H160: token },
      { u128: amount },
      { H160: t1Recipient },
      { u64: nonce }
    ]
  },
  'proxyCreateNftBatch': {
    pallet: 'nftManager',
    method: 'signedCreateBatch',
    nonceType: "batch",
    buildMethodParams: ({ totalSupply, royalties, t1Authority, }) => [totalSupply, royalties, t1Authority],
    buildSignData: ({ relayer, totalSupply, t1Authority, royalties, nonce }) => [
      { Text: 'authorization for create batch operation' },
      { AccountId: relayer },
      { u64: totalSupply },
      { SkipEncode: encodeRoyalties(royalties) },
      { H160: t1Authority },
      { u64: nonce }
    ]
  },
  'proxyCancelListFiatNft': {
    pallet: 'nftManager',
    method: 'signedCancelListFiatNft',
    nonceType: "nft",
    buildMethodParams: ({ nftId }) => [nftId],
    buildSignData: ({ relayer, nftId, nonce }) => [
      { Text: 'authorization for cancel list fiat nft for sale operation' },
      { AccountId: relayer },
      { U256: nftId },
      { u64: nonce }
    ]
  },
  'proxyEndNftBatchSale': {
    pallet: 'nftManager',
    method: 'signedEndBatchSale',
    nonceType: "batch",
    buildMethodParams: ({ batchId }) => [batchId],
    buildSignData: ({ relayer, batchId, nonce }) => [
      { Text: 'authorization for end batch sale operation' },
      { AccountId: relayer },
      { U256: batchId },
      { u64: nonce }
    ]
  },
  'proxyListNftOpenForSale': {
    pallet: 'nftManager',
    method: 'signedListNftOpenForSale',
    nonceType: "nft",
    buildMethodParams: ({ nftId, market }) => [nftId, market],
    buildSignData: ({ relayer, nftId, market, nonce }) => [
      { Text: 'authorization for list nft open for sale operation' },
      { AccountId: relayer },
      { U256: nftId },
      { u8: market },
      { u64: nonce }
    ]
  },
  'proxyListEthereumNftForSale': {
    pallet: 'nftManager',
    method: 'signedListNftOpenForSale',
    nonceType: "nft",
    buildMethodParams: ({ nftId, market }) => [nftId, market],
    buildSignData: ({ relayer, nftId, market, nonce }) => [
      { Text: 'authorization for list nft open for sale operation' },
      { AccountId: relayer },
      { U256: nftId },
      { u8: market },
      { u64: nonce }
    ]
  },
  'proxyListNftBatchForSale': {
    pallet: 'nftManager',
    method: 'signedListBatchForSale',
    nonceType: "batch",
    buildMethodParams: ({ batchId, market }) => [batchId, market],
    buildSignData: ({ relayer, batchId, market, nonce }) => [
      { Text: 'authorization for list batch for sale operation' },
      { AccountId: relayer },
      { U256: batchId },
      { u8: market },
      { u64: nonce }
    ]
  },
  'proxyListEthereumNftBatchForSale': {
    pallet: 'nftManager',
    method: 'signedListBatchForSale',
    nonceType: "batch",
    buildMethodParams: ({ batchId, market }) => [batchId, market],
    buildSignData: ({ relayer, batchId, market, nonce }) => [
      { Text: 'authorization for list batch for sale operation' },
      { AccountId: relayer },
      { U256: batchId },
      { u8: market },
      { u64: nonce }
    ]
  },
  'proxyMintSingleNft': {
    pallet: 'nftManager',
    method: 'signedMintSingleNft',
    buildMethodParams: ({ externalRef, royalties, t1Authority }) => [externalRef, royalties, t1Authority],
    buildSignData: ({ relayer, externalRef, t1Authority, royalties }) => [
      { Text: 'authorization for mint single nft operation' },
      { AccountId: relayer },
      { 'Vec<u8>': externalRef },
      { SkipEncode: encodeRoyalties(royalties) },
      { H160: t1Authority }
    ]
  },
  'proxyMintBatchNft': {
    pallet: 'nftManager',
    method: 'signedMintBatchNft',
    buildMethodParams: ({ externalRef, batchId, index, owner }) => [batchId, index, owner, externalRef],
    buildSignData: ({ relayer, externalRef, batchId, index, owner }) => [
      { Text: 'authorization for mint batch nft operation' },
      { AccountId: relayer },
      { U256: batchId },
      { u64: index },
      { 'Vec<u8>': externalRef },
      { AccountId: owner }
    ]
  },
  'proxyTransferFiatNft': {
    pallet: 'nftManager',
    method: 'signedTransferFiatNft',
    nonceType: "nft",
    buildMethodParams: ({ nftId, recipient }) => [nftId, recipient],
    buildSignData: ({ relayer, nftId, recipient, nonce }) => [
      { Text: 'authorization for transfer fiat nft operation' },
      { AccountId: relayer },
      { U256: nftId },
      { AccountId: recipient },
      { u64: nonce }
    ]
  },
  'proxyStakeAvt': {
    pallet: 'parachainStaking',
    method: 'signedNominate',
    nonceType: "staking",
    buildMethodParams: ({ targets, amount }) => [targets, amount],
    buildSignData: ({ relayer, amount, targets, nonce }) => [
      { Text: 'parachain authorization for nominate operation' },
      { AccountId: convertToPublicKey(relayer) },
      { 'Vec<LookupSource>': targets },
      { BalanceOf: amount },
      { u64: nonce }
    ]
  },
  'proxyIncreaseStake': {
    pallet: 'parachainStaking',
    method: 'signedBondExtra',
    nonceType: "staking",
    buildMethodParams: ({ amount }) => [amount],
    buildSignData: ({ relayer, amount, nonce }) => [
      { Text: 'parachain authorization for nominator bond extra operation' },
      { AccountId: relayer },
      { BalanceOf: amount },
      { u64: nonce }
    ]
  },
  'proxyUnstake': {
    pallet: 'parachainStaking',
    method: 'signedScheduleNominatorUnbond',
    nonceType: "staking",
    buildMethodParams: ({ amount }) => [amount],
    buildSignData: ({ relayer, amount, nonce }) => [
      { Text: 'parachain authorization for scheduling nominator unbond operation' },
      { AccountId: relayer },
      { BalanceOf: amount },
      { u64: nonce }
    ]
  },
  'proxyWithdrawUnlocked': {
    pallet: 'parachainStaking',
    method: 'signedExecuteNominationRequest',
    nonceType: 'staking',
    buildMethodParams: ({ user }) => [user],
    buildSignData: ({ relayer, user, nonce }) => [
      { Text: 'parachain authorization for executing nomination requests operation' },
      { AccountId: relayer },
      { BalanceOf: user },
      { u64: nonce }
    ]
  },
  'proxyScheduleLeaveNominators': {
    pallet: 'parachainStaking',
    method: 'signedScheduleLeaveNominators',
    nonceType: 'staking',
    buildMethodParams: ({ }) => [],
    buildSignData: ({ relayer, user, nonce }) => [
      { Text: 'parachain authorization for scheduling leaving nominators operation' },
      { AccountId: relayer },
      { u64: nonce }
    ]
  },
  'proxyExecuteLeaveNominators': {
    pallet: 'parachainStaking',
    method: 'signedExecuteLeaveNominators',
    nonceType: 'staking',
    buildMethodParams: ({ user }) => [user],
    buildSignData: ({ relayer, user, nonce }) => [
      { Text: 'parachain authorization for executing leave nominators operation' },
      { AccountId: relayer },
      { AccountId: user },
      { u64: nonce }
    ]
  },
  'proxyRegisterHandler': {
    pallet: 'avnAnchor',
    method: 'signedRegisterChainHandler',
    buildMethodParams: ({ user, name }) => [user, name],
    buildSignData: ({ relayer, handler, name }) => [
      { Text: 'register_chain_handler' },
      { AccountId: relayer },
      { AccountId: handler },
      { 'Vec<u8>': name },
    ]
  },
  'proxySubmitCheckpoint': {
    pallet: 'avnAnchor',
    method: 'signedSubmitCheckpointWithIdentity',
    nonceType: 'anchor',
    buildMethodParams: ({ user, checkpoint }) => [user, checkpoint],
    buildSignData: ({ relayer, handler, checkpoint, chainId, nonce }) => [
      { Text: 'submit_checkpoint' },
      { AccountId: relayer },
      { AccountId: handler },
      { H256: checkpoint },
      { u32: chainId },
      { u64: nonce }
    ]
  },
  'proxyCreateMarketAndDeployPool': {
    pallet: 'predictionMarkets',
    method: 'signedCreateMarketAndDeployPool',
    nonceType: 'predictionMarkets',
    buildMethodParams: ({ user }) => [user],
    buildSignData: ({ relayer, nonce,
      baseAsset,
      creatorFee,
      oracle,
      period,
      deadlines,
      metadata,
      marketType,
      disputeMechanism,
      amount,
      spotPrices,
      swapFee, }) => [
        { Text: 'create_market_and_deploy_pool' },
        { AccountId: relayer },
        { u64: nonce },
        { AssetOf: baseAsset },
        { Perbill: 0 },
        { AccountId: oracle },
        { MarketPeriodOf: period },
        { DeadlinePeriodOf: deadlines },
        { MultiHash: metadata },
        { MarketType: { Categorical: 0 } },
        { MarketDisputeMechanism: 0 },
        { BalanceOf: amount },
        { 'Vec<u8>': spotPrices },
        { BalanceOf: swapFee },
      ]
  },
  'proxyReport': {
    pallet: 'predictionMarkets',
    method: 'signedReport',
    nonceType: 'predictionMarkets',
    buildMethodParams: ({ user }) => [user],
    buildSignData: ({ relayer, nonce, outcome }) => [
      { Text: 'report_market_outcome_context' },
      { AccountId: relayer },
      { u64: nonce },
      { u32: outcome }
    ]
  },
  'proxyRedeemShares': {
    pallet: 'predictionMarkets',
    method: 'signedRedeemShares',
    nonceType: 'predictionMarkets',
    buildMethodParams: ({ user }) => [user],
    buildSignData: ({ relayer, nonce, marketId }) => [
      { Text: 'redeem_shares_context' },
      { AccountId: relayer },
      { u64: nonce },
      { u32: marketId }
    ]
  },
  'proxyTransferAsset': {
    pallet: 'predictionMarkets',
    method: 'signedTransferAsset',
    nonceType: 'predictionMarkets',
    buildMethodParams: ({ user }) => [user],
    buildSignData: ({ relayer, nonce, token, who, to, amount }) => [
      { Text: 'redeem_shares_context' },
      { AccountId: relayer },
      { u64: nonce },
      { H160: token },
      { AccountId: who },
      { AccountId: to },
      { BalanceOf: amount }
    ]
  },
  'proxySell': {
    pallet: 'hybridRouter',
    method: 'signedSell',
    nonceType: 'hybridRouter',
    buildMethodParams: ({ user }) => [user],
    buildSignData: ({ relayer, nonce, marketId, assetCount, asset, amountIn, minPrice, orders, strategy }) => [
      { Text: 'sell outcome tokens' },
      { AccountId: relayer },
      { u64: nonce },
      { u32: marketId },
      { u16: assetCount },
      { AssetOf: asset },
      { BalanceOf: amountIn },
      { BalanceOf: minPrice },
      { 'Vec<u128>': orders },
      { u8: strategy }
    ]
  },
  'proxyBuy': {
    pallet: 'hybridRouter',
    method: 'signedBuy',
    nonceType: 'hybridRouter',
    buildMethodParams: ({ user }) => [user],
    buildSignData: ({ relayer, nonce, marketId, assetCount, asset, amountIn, maxPrice, orders, strategy }) => [
      { Text: 'buy outcome tokens' },
      { AccountId: relayer },
      { u64: nonce },
      { u32: marketId },
      { u16: assetCount },
      { AssetOf: asset },
      { BalanceOf: amountIn },
      { BalanceOf: maxPrice },
      { 'Vec<u128>': orders },
      { u8: strategy }
    ]
  },
};

function validateSignData(signData: SignDataItem[]): void {
  try {
    signData.forEach(item => {
      for (const [type, value] of Object.entries(item)) {
        const validator = typeValidationMap[type];
        if (validator && !validator(value)) {
          throw new Error(`Invalid value ${value} for type ${type}`);
        }
      }
    });
  } catch (err) {
    console.error('Validation error:', err);
    throw err;
  }
}