import {
  init, callWithTimeout, requestFailed, buildErrorBody, isValidCurrencyFormat, isValidProxySignature, axios, toBnString,
  isValidAccountId, getProxyProof, isValidSignatureFormat, isSplitFeeTransaction, isValidNonce,
  publishEvent, buildValidResponseBody, isValidString, isValidEthereumAddress, isValidNftId,
  isValidAmount, isValidEthereumTransactionHash, encodeRoyalties, convertToPublicKey,
  NONCE_INFO, WEBHOOK_EVENT_TYPES,
  isValidArray,
} from '/opt/utils';
import * as fees from '/opt/paymentUtils';
import * as sqs from '/opt/sqsUtils';
import {
  StatusCode, CustomSQSHandler, ValidResponse,
  ProxyParams, ProxyProof, QueryParams,
  CallConfig, ProxyTransaction, ProxyCall,
  BatchProxyParams
} from '/opt/handler-types';
import { ErrorBody, SendTxResult, SignDataItem } from '/opt/types';

// @ts-ignore
import { SQSEvent, Context, SQSBatchResponse, APIGatewayProxyResult } from 'aws-lambda';

const AVN_CONNECTOR_ENDPOINT: string = process.env.AVN_CONNECTOR_ENDPOINT || '';
const SQS_TX_QUEUE_URL: string = process.env.SQS_TX_QUEUE_URL || '';

interface PaymentInfo {
  paymentInfo?: any;
  splitFeePayerAddress?: string;
  splitFeePayerVaultId?: string;
  relayerFees?: any;
  splitFeeProxyProof?: ProxyProof;
}

type ProxyMethodResult = { ok: true; params: ProxyParams, pallet: string, method: string } | { ok: false; error: ErrorBody };

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

  switch (call.method) {
    case 'proxyExitPredictionMarketLiquidity':
      return await processProxyExitWithFees(call, request, requestId);
    case 'proxyLowerFromPredictionMarket':
      return await processLowerFromPredictionMarket(call, request, requestId);
  }


  if (callConfigs[call.method]) {
    const result = await processProxyCall(call.method, call, request, requestId);
    if (result.ok === false) {
      return result.error;
    }

    return await sendTx(call, request, requestId, result.pallet, result.method, result.params);
  } else {
    return buildErrorBody('method', 'Method not found', call.method, request, call.id);
  }
}

//TODO: Fix me. We should not read the nonce from the chain because we risk getting duplicate values for different tx's
async function queryNonce(requestId: string, nonceInfo: { palletName: string, storageName: string }, nonceKey: string): Promise<string> {
  const { palletName, storageName } = nonceInfo;
  console.info(`${requestId} - Refreshing nonce from chain for ${palletName}.${storageName} - ${nonceKey}`);
  const params: QueryParams = { requestId, palletName, storageName, params: [nonceKey] };
  const result = await axios.post(`${AVN_CONNECTOR_ENDPOINT}avnQuery`, params);
  const nonce = storageName === 'nfts' ? toBnString(result.data.nonce) : toBnString(result.data);
  console.info(`${requestId} - new nonce: ${nonce}`);
  return nonce;
}

async function processProxyCall(
  callType: string,
  call: ProxyCall,
  request: string,
  requestId: string,
): Promise<ProxyMethodResult> {
  if(Array.isArray(call.params)) {
    throw new Error(`call params must not be an array. To use batch calls, use an appropriate method`);
  }

  // Do not use call.method here batch calls use a different outer call method to the inner calls
  const config = callConfigs[callType];
  if (!config) {
    throw new Error(`No configuration found for call type ${callType}`);
  }

  const { pallet, method, buildMethodParams } = config;
  const methodParams = await buildMethodParams(call.params);

  try {
    await validateProxySignature(config, call, request, requestId);
  } catch (err) {
    console.error(`Error in processProxyCall:`, err);
    const badParamValue = err.toString();
    return { ok: false, error: buildErrorBody('params', `invalid ${badParamValue}`, badParamValue, request, call.id)};
  }

  const validationError = validateProxyCallParams(call, request);
  if (validationError) return { ok: false, error: validationError };

  const { relayer, user, proxySignature, currencyToken } = call.params;
  const proxyProof: ProxyProof = getProxyProof(user, relayer, proxySignature);


  let paymentInfo: PaymentInfo;
  try {
    paymentInfo = await setupPaymentInfo(call, proxyProof, requestId);
  } catch (error) {
    console.error(`Failed to get payment information for ${pallet}.${method}`, error);
    throw error;
  }

  const params: ProxyParams = {
    proxyParams: [proxyProof].concat(methodParams),
    relayerAddress: relayer,
    currencyToken
  };

  if (isSplitFeeTransaction(call)) {
    params.splitFeePayerAddress = paymentInfo.splitFeePayerAddress;
    params.splitFeePayerVaultId = paymentInfo.splitFeePayerVaultId;
    params.relayerFees = paymentInfo.relayerFees;
    params.splitFeeProxyProof = paymentInfo.splitFeeProxyProof;
    const eventType = WEBHOOK_EVENT_TYPES.tx_ready;
    await publishEvent(AVN_CONNECTOR_ENDPOINT, eventType, requestId, call.splitFeePayerAddress, {
      relayer,
      user,
      proxySignature,
      pallet,
      method,
      methodParams,
      currencyToken
    });
  } else {
    params.paymentInfo = paymentInfo.paymentInfo;
  }

  return { ok: true, params, pallet, method };
}

async function sendTx(
  call: ProxyCall,
  request: string,
  requestId: string,
  palletName: string,
  method: string,
  params: ProxyParams | BatchProxyParams[]
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

async function getDefaultMarketOpeningValues(baseAssetEthAddress: string): Promise<any> {
  const queryParams: QueryParams = { requestId: "", palletName: 'assetRegistry', storageName: 'ethAddressToAssetId', params: [baseAssetEthAddress] };
  const result = await axios.post(`${AVN_CONNECTOR_ENDPOINT}avnQuery`, queryParams);
  const baseAsset = result.data;

  if (!baseAsset) {
    throw new Error(`Invalid base asset eth address: ${baseAssetEthAddress}. Asset not found`);
  }

  const creatorFee = 0;
  const marketType = { Categorical: 2 };
  const disputeMechanism = undefined;
  const swapFee = "30000000"; //0.3% (remember its 10 decimal places not 18)

  return { baseAsset, creatorFee, marketType, disputeMechanism, swapFee };
}

async function getCreateMarketSignDataItems(params: any): Promise<SignDataItem[]> {
  const {
    relayer,
    nonce,
    baseAssetEthAddress,
    oracle,
    period,
    deadlines,
    metadata,
    amount,
    spotPrices,
  } = params;

  const { baseAsset, creatorFee, marketType, disputeMechanism, swapFee } = await getDefaultMarketOpeningValues(baseAssetEthAddress);

  return [
    { Text: 'create_market_and_deploy_pool' },
    { AccountId: relayer },
    { u64: nonce },
    { AssetOf: baseAsset },
    { Perbill: creatorFee },
    { AccountId: oracle },
    { MarketPeriodOf: period },
    { Deadlines: deadlines },
    { MultiHash: metadata },
    { MarketType: marketType },
    { 'Option<MarketDisputeMechanism>': disputeMechanism },
    { BalanceOf: amount },
    { 'Vec<BalanceOf>': spotPrices },
    { BalanceOf: swapFee },
  ];
}

async function getCreateMarketAndDeployPoolMethodParams(params: any): Promise<any[]> {
  const {
    baseAssetEthAddress,
    oracle,
    period,
    deadlines,
    metadata,
    amount,
    spotPrices,
  } = params;

  const { baseAsset, creatorFee, marketType, disputeMechanism, swapFee } = await getDefaultMarketOpeningValues(baseAssetEthAddress);

  return [
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
    swapFee
  ];
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
    buildMethodParams: ({ user, checkpoint, checkpointOriginId }) => [user, checkpoint, checkpointOriginId],
    buildSignData: ({ relayer, handler, checkpoint, chainId, nonce, checkpointOriginId }) => [
      { Text: 'submit_checkpoint' },
      { AccountId: relayer },
      { AccountId: handler },
      { H256: checkpoint },
      { u32: chainId },
      { u64: nonce },
      { u64: checkpointOriginId }
    ]
  },
  'proxyCreateMarketAndDeployPool': {
    pallet: 'predictionMarkets',
    method: 'signedCreateMarketAndDeployPool',
    nonceType: 'prediction_User',
    buildMethodParams: async (params) => await getCreateMarketAndDeployPoolMethodParams(params),
    buildSignData: async (params) => await getCreateMarketSignDataItems(params)
  },
  'proxyReportMarketOutcome': {
    pallet: 'predictionMarkets',
    method: 'signedReport',
    nonceType: 'prediction_Market',
    buildMethodParams: ({ marketId, outcome }) => [marketId, outcome],
    buildSignData: ({ relayer, nonce, marketId, outcome }) => [
      { Text: 'report_market_outcome_context' },
      { AccountId: relayer },
      { u64: nonce },
      { u128: marketId },
      { OutcomeReport: outcome }
    ]
  },
  'proxyRedeemMarketShares': {
    pallet: 'predictionMarkets',
    method: 'signedRedeemShares',
    nonceType: 'prediction_Market',
    buildMethodParams: ({ marketId }) => [marketId],
    buildSignData: ({ relayer, nonce, marketId }) => [
      { Text: 'redeem_shares_context' },
      { AccountId: relayer },
      { u64: nonce },
      { u128: marketId }
    ]
  },
  'proxyTransferMarketTokens': {
    pallet: 'predictionMarkets',
    method: 'signedTransferAsset',
    nonceType: 'prediction_User',
    buildMethodParams: ({ assetEthAddress, to, amount }) => [assetEthAddress, to, amount],
    buildSignData: ({ relayer, user, nonce, assetEthAddress, to, amount }) => [
      { Text: 'transfer_tokens_context' },
      { AccountId: relayer },
      { u64: nonce },
      { H160: assetEthAddress },
      { AccountId: user },
      { AccountId: to },
      { BalanceOf: amount }
    ]
  },
  'proxySellMarketOutcomeTokens': {
    pallet: 'hybridRouter',
    method: 'signedSell',
    nonceType: 'hybridRouter',
    buildMethodParams: ({ marketId, assetCount, asset, amountIn, minPrice, orders, strategy }) => [marketId, assetCount, asset, amountIn, minPrice, orders, strategy],
    buildSignData: ({ relayer, nonce, marketId, assetCount, asset, amountIn, minPrice, orders, strategy }) => [
      { Text: 'sell outcome tokens' },
      { AccountId: relayer },
      { u64: nonce },
      { u128: marketId },
      { u16: assetCount },
      { AssetOf: asset },
      { BalanceOf: amountIn },
      { BalanceOf: minPrice },
      { 'Vec<u128>': orders },
      { u8: strategy }
    ]
  },
  'proxyBuyMarketOutcomeTokens': {
    pallet: 'hybridRouter',
    method: 'signedBuy',
    nonceType: 'hybridRouter',
    buildMethodParams: ({ marketId, assetCount, asset, amountIn, maxPrice, orders, strategy }) => [marketId, assetCount, asset, amountIn, maxPrice, orders, strategy],
    buildSignData: ({ relayer, nonce, marketId, assetCount, asset, amountIn, maxPrice, orders, strategy }) => [
      { Text: 'buy outcome tokens' },
      { AccountId: relayer },
      { u64: nonce },
      { u128: marketId },
      { u16: assetCount },
      { AssetOf: asset },
      { BalanceOf: amountIn },
      { BalanceOf: maxPrice },
      { 'Vec<u128>': orders },
      { 'Strategy': strategy }
    ]
  },
  'proxyWithdrawMarketTokens': {
    pallet: 'predictionMarkets',
    method: 'signedWithdrawTokens',
    nonceType: 'prediction_User',
    buildMethodParams: ({ assetEthAddress, amount }) => [assetEthAddress, amount],
    buildSignData: ({ relayer, user, nonce, assetEthAddress, amount }) => [
      { Text: 'withdraw_tokens_context' },
      { AccountId: relayer },
      { u64: nonce },
      { H160: assetEthAddress },
      { AccountId: user },
      { BalanceOf: amount }
    ]
  },
  'proxyRegisterNode': {
    pallet: 'nodeManager',
    method: 'signedRegisterNode',
    buildMethodParams: ({ nodeId, nodeOwner, nodeSigningKey, blockNumber }) => [nodeId, nodeOwner, nodeSigningKey, blockNumber],
    buildSignData: ({ relayer, nodeId, nodeOwner, nodeSigningKey, blockNumber }) => [
      { Text: 'register_node' },
      { AccountId: relayer },
      { AccountId: nodeId },
      { AccountId: nodeOwner },
      { AccountId: nodeSigningKey },
      { BlockNumber: blockNumber },
    ]
  },
  'proxyDeregisterNodes': {
    pallet: 'nodeManager',
    method: 'signedDeregisterNodes',
    buildMethodParams: ({ nodeOwner, nodesToDeregister, blockNumber }) => [nodeOwner, nodesToDeregister, blockNumber],
    buildSignData: ({ relayer, nodeOwner, nodesToDeregister, blockNumber }) => [
      { Text: 'deregister_node' },
      { AccountId: relayer },
      { AccountId: nodeOwner },
      { 'Vec<AccountId>': nodesToDeregister },
      { u32: nodesToDeregister.length },
      { BlockNumber: blockNumber }
    ]
  },
  'proxyAddPredictionMarketLiquidity': {
    pallet: 'neoSwaps',
    method: 'signedJoin',
    buildMethodParams: ({ marketId, poolSharesAmount, maxAmountsIn, blockNumber }) => [marketId, poolSharesAmount, maxAmountsIn, blockNumber],
    buildSignData: ({ relayer, marketId, poolSharesAmount, maxAmountsIn, blockNumber }) => [
      { Text: 'neo_swap::join_context' },
      { AccountId: relayer },
      { u128: marketId },
      { BalanceOf: poolSharesAmount },
      { 'Vec<BalanceOf>': maxAmountsIn },
      { BlockNumber: blockNumber },
    ]
  },
  'proxyWithdrawPredictionMarketLiquidityFees': {
    pallet: 'neoSwaps',
    method: 'signedWithdrawFees',
    buildMethodParams: ({ marketId, blockNumber }) => [marketId, blockNumber],
    buildSignData: ({ relayer, marketId, blockNumber }) => [
      { Text: 'neo_swap::withdraw_fees_context' },
      { AccountId: relayer },
      { u128: marketId },
      { BlockNumber: blockNumber },
    ]
  },
  'proxyBuyCompletePredictionMarketOutcomeTokens': {
    pallet: 'predictionMarkets',
    method: 'signedBuyCompleteSet',
    buildMethodParams: ({ marketId, amount }) => [marketId, amount],
    buildSignData: ({ relayer, nonce, marketId, amount }) => [
      { Text: 'buy_complete_set_context' },
      { AccountId: relayer },
      { u64: nonce },
      { u128: marketId },
      { BalanceOf: amount },
    ]
  },
  'proxyExitPredictionMarketLiquidity': {
    pallet: 'neoSwaps',
    method: 'signedExit',
    buildMethodParams: ({ marketId, poolSharesAmountOut, minAmountsOut, blockNumber }) => [marketId, poolSharesAmountOut, minAmountsOut, blockNumber],
    buildSignData: ({ relayer, marketId, blockNumber, poolSharesAmountOut, minAmountsOut }) => [
      { Text: 'neo_swap::exit_context' },
      { AccountId: relayer },
      { u128: marketId },
      { BalanceOf: poolSharesAmountOut },
      { 'Vec<BalanceOf>': minAmountsOut },
      { BlockNumber: blockNumber }
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


async function processLowerFromPredictionMarket(call: ProxyCall, request: string, requestId: string): Promise<ValidResponse | ErrorBody> {
  if(!Array.isArray(call.params)) {
    return buildErrorBody('params', 'Expected batch transactions', '', request, call.id);
  }

  // the ordering of the array objects is important - they go into the batch in that order
  // we can't use an object because we need to support other batch calls
  const [ withdrawProxyParams, lowerProxyParams ] = call.params;
  if (!withdrawProxyParams || !lowerProxyParams) {
    return buildErrorBody('params', 'Missing required parameters', 'withdrawProxyParams or lowerProxyParams', request, call.id);
  }

  const withdrawCall = {
    ...call,
    params: {
      ...withdrawProxyParams,
      currencyToken: withdrawProxyParams.currencyToken
    }
  };
  let result = await processProxyCall(withdrawProxyParams.txType, withdrawCall, request, requestId);
  if (result.ok === false) {
    return result.error;
  }
  const withdrawCallParams = {
    palletName: 'predictionMarkets',
    method: 'signedWithdrawTokens',
    params: result.params
  }

  const lowerCall = {
    ...call,
    params: {
      ...lowerProxyParams,
      currencyToken: lowerProxyParams.currencyToken
    }
  };
  result = await processProxyCall(lowerProxyParams.txType, lowerCall, request, requestId);
  if (result.ok === false) {
    return result.error;
  }
  const lowerCallParams = {
    palletName: 'tokenManager',
    method: 'scheduleSignedLower',
    params: result.params
  }

   const batchCalls = [withdrawCallParams, lowerCallParams];
   return await sendTx(call, request, requestId, 'utility', 'batchAll', batchCalls);
}

async function processProxyExitWithFees(call: ProxyCall, request: string, requestId: string): Promise<ValidResponse | ErrorBody> {
  if(!Array.isArray(call.params)) {
    return buildErrorBody('params', 'Expected batch transactions', '', request, call.id);
  }
  // the ordering of the array objects is important - they go into the batch in that order
  // we can't use an object because we need to support other batch calls
   const [ withdrawFeeParams, exitMarketParams ] = call.params;

   if (!exitMarketParams || !withdrawFeeParams) {
     return buildErrorBody('params', 'Missing required parameters', 'exitMarketParams or withdrawFeeParams', request, call.id);
   }

   const exitCall = {
     ...call,
     params: {
       ...exitMarketParams,
       currencyToken: exitMarketParams.currencyToken
     }
   };
   let result = await processProxyCall(exitMarketParams.txType, exitCall, request, requestId);
   if (result.ok === false) {
     return result.error;
   }
   const exitCallParams = {
     palletName: 'neoSwaps',
     method: 'signedExit',
     params: result.params
   }

   const withdrawCall = {
     ...call,
     params: {
       ...withdrawFeeParams,
       currencyToken: withdrawFeeParams.currencyToken
     }
   };
   result = await processProxyCall(withdrawFeeParams.txType, withdrawCall, request, requestId);
   if (result.ok === false) {
     return result.error;
   }
   const withdrawFeesCallParams = {
     palletName: 'neoSwaps',
     method: 'signedWithdrawFees',
     params: result.params
   }

   const batchCalls = [withdrawFeesCallParams, exitCallParams];
   return await sendTx(call, request, requestId, 'utility', 'batchAll', batchCalls);
 }

function validateProxyCallParams(call: ProxyCall, request: string): ErrorBody | null {
  const { relayer, user, payer, proxySignature, currencyToken } = call.params;

  try {
    if (!isValidAccountId(relayer)) throw 'relayer';
    if (!isValidAccountId(user)) throw 'user';
    if (!isValidAccountId(payer)) throw 'payer';
    if (!isValidSignatureFormat(proxySignature)) throw 'proxySignature';
    if (!isValidCurrencyFormat(currencyToken)) throw 'currencyToken';

    if (!isSplitFeeTransaction(call)) {
      if (!isValidSignatureFormat(call.params.feePaymentSignature)) throw 'feePaymentSignature';
      if (!isValidNonce(call.params.paymentNonce)) throw 'paymentNonce';
    }
    return null;
  } catch (param) {
    return buildErrorBody('params', `invalid proxy method ${param}: ${call.params[param]}`, param, request, call.id);
  }
}

async function validateProxySignature(config: CallConfig, call: ProxyCall, request: string, requestId: string) {
  if (config.nonceType) {
    let nonce = call.params.nonce ?? await queryNonce(requestId, NONCE_INFO[config.nonceType], call.params.user);
    call.params.nonce = nonce;
  }

  const signData = await config.buildSignData({ ...call.params });

  validateSignData(signData);
  if (!isValidProxySignature(call.params.proxySignature, call.params.user, signData)) {
    throw 'proxySignature';
  }
}

async function setupPaymentInfo(
  call: ProxyCall,
  proxyProof: ProxyProof,
  requestId: string,
): Promise<PaymentInfo> {
  if (!call || !proxyProof || !requestId) {
    throw new Error('Missing required parameters for payment setup');
  }

  const { relayer, payer, currencyToken } = call.params;
  const paymentInfo: PaymentInfo = {};

  if (isSplitFeeTransaction(call)) {
    if (!call.splitFeePayerAddress || !call.splitFeePayerVaultId || !call.relayerFee) {
      throw new Error('Missing required split fee transaction parameters');
    }

    paymentInfo.splitFeePayerAddress = call.splitFeePayerAddress;
    paymentInfo.splitFeePayerVaultId = call.splitFeePayerVaultId;
    paymentInfo.relayerFees = call.relayerFee;
    paymentInfo.splitFeeProxyProof = proxyProof;

  } else {
    if (!call.params.feePaymentSignature || call.params.paymentNonce === undefined || call.params.paymentNonce === null) {
      throw new Error('Missing required standard payment parameters');
    }

    const paymentData = await fees.tryGetPaymentInfo(
      AVN_CONNECTOR_ENDPOINT,
      payer,
      relayer,
      call.params.feePaymentSignature,
      call.method,
      call.params.paymentNonce,
      proxyProof,
      currencyToken,
    );

    paymentInfo.paymentInfo = paymentData;
  }

  return paymentInfo;
}