import { init, buildErrorBody, isValidAccountId, isValidString, buildValidResponseBody, axios,
  isValidNftId, isValidEthereumAddress, convertToAddress, convertToPublicKey, BN, toBnString,
  NONCE_INFO, isValidCurrencyFormat} from '/opt/utils';
import { Call, ValidError, ValidResponse } from '/opt/handler-types';
import { ErrorBody } from '/opt/types';
// @ts-ignore
import { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda';

const AVN_CONNECTOR_ENDPOINT = process.env.AVN_CONNECTOR_ENDPOINT as string;
const BLOCK_EXPLORER_BASE_URL = process.env.BLOCK_EXPLORER_BASE_URL as string;

export const handler: APIGatewayProxyHandler = async (event): Promise<APIGatewayProxyResult> => {
  await init();
  return {
    statusCode: 200,
    body: JSON.stringify(await processRequest(event.body))
  };
};

async function processRequest(request: string): Promise<any> {
  let call: Call;

  try {
    call = JSON.parse(request);
  } catch (err) {
    return buildErrorBody('parse', 'failed to parse JSON', err.toString(), request, null);
  }

  if (call.id === undefined) call.id = null;

  if (typeof call.method !== 'string') {
    return buildErrorBody('request', 'method type must be string', call.method, request, call.id);
  } else {
    return await callSwitch(call, request);
  }
}

// Keep alphabetical
async function callSwitch(call: Call, request: string): Promise<ValidResponse | ErrorBody> {
  console.info(`Processing call: ${JSON.stringify(call)}`);

  switch (call.method) {
    case 'getNonce':
      return await getNonce(call, request);
    case 'getAvtBalance':
      return await getAvtBalance(call, request);
    case 'getAvtContractAddress':
      return await getAvtContractAddress(call, request);
    case 'getAvnContractAddress':
      return await getAvnContractAddress(call, request);
    case 'getDefaultRelayer':
      return await getDefaultRelayer(call, request);
    case 'getNativeCurrencyToken':
      return await getNativeCurrencyToken(call, request);
    case 'getNftContractAddress':
      return await getNftContractAddress(call, request);
    case 'getNftId':
      return await getNftId(call, request);
    case 'getNftNonce':
      return await getNftNonce(call, request);
    case 'getNftOwner':
      return await getNftOwner(call, request);
    case 'getRelayerFees':
      return await getRelayerFees(call, request);
    case 'getTokenBalance':
      return await getTokenBalance(call, request);
    case 'getTotalAvt':
      return await getTotalAvt(call, request);
    case 'getTotalToken':
      return await getTotalToken(call, request);
    case `getAccountInfo`:
      return await getAccountInfo(call, request);
    case 'getStakingStatus':
      return await getStakingStatus(call, request);
    case 'getValidatorsToNominate':
      return await queryValidatorsToNominateFromChain(call, request);
    case 'getMinTotalNominatorStake':
      return await getMinTotalNominatorStake(call, request);
    case 'getActiveEra':
      return await queryActiveEra(call, request);
    case 'getStakingDelay':
      return await queryStakingDelay(call, request);
    case 'getOwnedNfts':
      return await getOwnedNfts(call, request);
    case 'getStakingStats':
      return await getStakingStats(call, request);
    case 'getStakerRewardsEarned':
      return await getStakerRewardsEarned(call, request);
    case 'getCurrentBlock':
      return await getCurrentBlock(call, request);
    case 'getChainInfo':
      return await getChainInfo(call, request);
    case 'getEthereumEventStatus':
      return await getEthereumEventStatus(call, request);
    case 'getNftInfo':
      return await getNftInfo(call, request);
    case 'getBatchInfo':
      return await getBatchInfo(call, request);
    case 'getNftListingStatus':
      return await getNftListingStatus(call, request);
    case 'getBatchListingStatus':
      return await getBatchListingStatus(call, request);
    case 'getLoweringStatus':
        return await getLoweringStatus(call, request);
    case 'getSupportedCurrencies':
      return await getSupportedCurrencies(call, request);
    case 'isHandlerRegistered':
      return await isHandlerRegistered(call, request)
    case 'getAnchorNonce':
      return await getAnchorNonce(call, request)
    case 'getPredictionMarketsNonce':
      return await getPredictionMarketsNonce(call, request)
    case 'getHybridRouterNonce':
      return await getHybridRouterNonce(call, request)
    case 'getAssetIdFromEthToken':
      return await getAssetIdFromEthToken(call, request)
    case 'getPredictionMarketConstants':
      return await getPredictionMarketConstants(call, request)

    default:
      return buildErrorBody('method', 'method not found', call.method, request, call.id);
  }
}

async function getNonce(call: Call, request: string): Promise<ValidResponse | ErrorBody> {
  const { accountId, nonceType } = call.params;

  if (!accountId || !isValidAccountId(accountId)) {
    return buildErrorBody('params', 'invalid account ID', accountId ?? 'undefined', request, call.id);
  }

  if (!nonceType || !(nonceType in NONCE_INFO)) {
    return buildErrorBody('params', 'invalid nonce type', nonceType ?? 'undefined', request, call.id);
  }

  const { palletName, storageName } = NONCE_INFO[nonceType];

  return await queryChain(call, request, palletName, storageName, [accountId], formatNumAsString);
}

async function getAvtBalance(call: Call, request: string): Promise<ValidResponse | ErrorBody> {
  const { accountId } = call.params;

  if (!isValidAccountId(accountId)) {
    return buildErrorBody('params', 'invalid account ID', accountId, request, call.id);
  } else {
    return await queryChain(call, request, 'system', 'account', [accountId], formatBalanceAsString);
  }
}

async function getLoweringStatus(call: Call, request: string): Promise<ValidResponse | ErrorBody> {
  return await queryChain(call, request, 'tokenManager', 'lowersDisabled', [], formatAsLowerStatus);
}

async function getAvtContractAddress(call: Call, request: string): Promise<ValidResponse | ErrorBody> {
  return await getChainInfo(call, request, filterAvtContract);
}

async function getAvnContractAddress(call: Call, request: string): Promise<ValidResponse | ErrorBody> {
  return await getChainInfo(call, request, filterAvnContract);
}

async function getDefaultRelayer(call: Call, request: string): Promise<ValidResponse | ErrorBody> {
  const method = 'getDefaultRelayer';
  const params = { callId: call.id };
  return await query(call, request, method, params);
}

async function getNativeCurrencyToken(call: Call, request: string): Promise<ValidResponse | ErrorBody> {
  const method = 'nativeCurrencyToken';
  const params = { callId: call.id };
  return await query(call, request, method, params);
}

async function getNftContractAddress(call: Call, request: string): Promise<ValidResponse | ErrorBody> {
  const method = 'avnNftContractAddresses';
  return await query(call, request, method, {});
}

async function getSupportedCurrencies(call: Call, request: string): Promise<ValidResponse | ErrorBody> {
  const method = 'supportedCurrencies';
  return await query(call, request, method, {});
}

async function getNftId(call: Call, request: string) {
  const { externalRef } = call.params;

  if (isValidString(externalRef) === false) {
    return buildErrorBody('params', 'invalid external ref', externalRef, request, call.id);
  }

  try {
    const uniqueExternalRef = '0x' + Buffer.from(externalRef, 'utf8').toString('hex');
    const callArgs = { uniqueExternalRef };
    const proxyArgs = { call: { value: callArgs } };
    const query = `query GatewayApiNftId {
      events (
        where: {
          name_in: ["NftManager.BatchNftMinted","NftManager.SingleNftMinted"],
          call: {
            args_jsonContains: ${JSON.stringify(JSON.stringify(callArgs))},
            OR: { args_jsonContains: ${JSON.stringify(JSON.stringify(proxyArgs))} }
          }
        }, limit: 1) { args } }`;
    const response = await axios.post(BLOCK_EXPLORER_BASE_URL, { query, operationName: 'GatewayApiNftId' });
    const events = response.data.data.events;
    const nftId = events.length === 1 ? events[0].args.nftId : '';
    return buildValidResponseBody(call.id, nftId);
  } catch (err) {
    return buildErrorBody('internal', err, err.toString(), request, call.id);
  }
}

async function getNftNonce(call: Call, request: string): Promise<ValidResponse | ErrorBody> {
  const { nftId } = call.params;

  if (isValidNftId(nftId) === false) {
    return buildErrorBody('params', 'invalid nft id', nftId, request, call.id);
  } else {
    const { palletName, storageName } = NONCE_INFO.nft;
    return await queryChain(call, request, palletName, storageName, [nftId], formatNftNonceAsString);
  }
}

async function getNftInfo(call: Call, request: string): Promise<ValidResponse | ErrorBody> {
  const { nftId } = call.params;

  if (isValidNftId(nftId) === false) {
    return buildErrorBody('params', 'invalid nft id', nftId, request, call.id);
  } else {
    const method = 'getNftInfo';
    const params = { callId: call.id, nftId };
    return await query(call, request, method, params, formatAsNull);
  }
}

async function getBatchInfo(call: Call, request: string): Promise<ValidResponse | ErrorBody> {
  const { batchId } = call.params;

  if (isValidNftId(batchId) === false) {
    return buildErrorBody('params', 'invalid batch id', batchId, request, call.id);
  } else {
    const method = 'getBatchInfo';
    const params = { callId: call.id, batchId };
    return await query(call, request, method, params, formatAsNull);
  }
}

async function getNftListingStatus(call: Call, request: string): Promise<ValidResponse | ErrorBody> {
  const { nftId } = call.params;

  if (isValidNftId(nftId) === false) {
    return buildErrorBody('params', 'invalid nft id', nftId, request, call.id);
  } else {
    return await queryChain(call, request, 'nftManager', 'nftOpenForSale', [nftId], formatListingAsString);
  }
}

async function getBatchListingStatus(call: Call, request: string): Promise<ValidResponse | ErrorBody> {
  const { batchId } = call.params;

  // NftIs and BatchId have the same format
  if (isValidNftId(batchId) === false) {
    return buildErrorBody('params', 'invalid batch id', batchId, request, call.id);
  } else {
    return await queryChain(call, request, 'nftManager', 'batchOpenForSale', [batchId], formatListingAsString);
  }
}

async function getNftOwner(call: Call, request: string): Promise<ValidResponse | ErrorBody> {
  const { nftId } = call.params;

  if (isValidNftId(nftId) === false) {
    return buildErrorBody('params', 'invalid nft id', nftId, request, call.id);
  } else {
    return await queryChain(call, request, 'nftManager', 'nfts', [nftId], filterNftOwner);
  }
}

async function getRelayerFees(call: Call, request: string): Promise<ValidResponse | ErrorBody> {
  let { relayer, user, transactionType, currencyToken } = call.params;

  try {
    if (isValidAccountId(relayer) === false) throw 'relayer';
    if (isValidCurrencyFormat(currencyToken) === false) throw 'currencyToken';
    if (user && isValidAccountId(user) === false) throw 'user';
  } catch (param) {
    const gatewayError = 'invalid ' + param;
    return buildErrorBody('params', gatewayError, call.params, request, call.id);
  }

  try {
    relayer = convertToAddress(relayer);
    if (user) user = convertToAddress(user);
    const avnResponse = await axios.post(AVN_CONNECTOR_ENDPOINT + 'relayerFees', { relayer, user, transactionType, currencyToken });
    let result = avnResponse.data;
    result = typeof result === 'number' ? result.toString() : result;
    return buildValidResponseBody(call.id, result);
  } catch (err) {
    return buildErrorBody('internal', err?.response?.data?.error, err.toString(), request, call.id);
  }
}

async function getTokenBalance(call: Call, request: string): Promise<ValidResponse | ErrorBody> {
  const { accountId, token } = call.params;

  try {
    if (isValidAccountId(accountId) === false) throw 'account ID';
    if (isValidEthereumAddress(token) === false) throw 'token';
  } catch (param) {
    const gatewayError = 'invalid ' + param;
    return buildErrorBody('params', gatewayError, call.params, request, call.id);
  }

  return await queryChain(call, request, 'tokenManager', 'balances', [[token, accountId]], formatNumAsString);
}

async function getTotalAvt(call, request) {
  return await queryChain(call, request, 'balances', 'totalIssuance', [], formatNumAsString);
}

async function getTotalToken(call, request) {
  const { token } = call.params;

  if (isValidEthereumAddress(token) === false) {
    return buildErrorBody('params', 'invalid token', token, request, call.id);
  } else {
    const method = 'avnTotalToken';
    const params = { callId: call.id, token };
    return await query(call, request, method, params, formatTotal);
  }
}

async function getAccountInfo(call, request) {
  const { accountId } = call.params;

  if (isValidAccountId(accountId) === false) {
    return buildErrorBody('params', 'invalid account ID', accountId, request, call.id);
  } else {
    return await queryAccountInfoFromChain(call, request, accountId);
  }
}

async function queryActiveEra(call: Call, request: string): Promise<ValidResponse | ValidError> {
  return await queryChain(call, request, 'parachainStaking', 'era', [], formatEraAsString);
}

async function queryStakingDelay(call: Call, request: string): Promise<ValidResponse | ValidError> {
  return await queryChain(call, request, 'parachainStaking', 'delay');
}

async function queryChain(call: Call, request: string, palletName: string, storageName: string, params: any[] = [], responseFormatter?: (data: any) => string): Promise<any> {
  const method = 'avnQuery';
  const requestParams = { callId: call.id, palletName, storageName, params };

  return await query(call, request, method, requestParams, responseFormatter);
}

async function getStakingStatus(call, request) {
  const { accountId } = call.params;

  if (isValidAccountId(accountId) === false) {
    return buildErrorBody('params', 'invalid account ID', accountId, request, call.id);
  } else {
    return await queryChain(call, request, 'parachainStaking', 'nominatorState', [accountId], formatAsNominatingEnum);
  }
}

async function queryAccountInfoFromChain(call: Call, request: string, accountId: string) {
  const method = 'avnAccountInfo';
  const params = { callId: call.id, accountId };

  return await query(call, request, method, params);
}

async function getEthereumEventStatus(call: Call, request: string): Promise<any | ErrorBody> {
  const method = 'ethereumEventStatus';
  const {txHash} = call.params;
  let response: any = await query(call, request, method, {txHash});

  console.info(`Checked Ethereum event status: ${JSON.stringify(response)}`);

  if (response.result) {
    return { result: response.result.liftStatus };
  }

  return undefined;
}

async function getPredictionMarketConstants(call: Call, request: string): Promise<ValidResponse | ErrorBody> {
  const method = 'getPredictionMarketConstants';
  let result = await query(call, request, method);
  console.info(`Prediction market constants: ${result}`);

  return result;
}

async function queryValidatorsToNominateFromChain(call: Call, request: string): Promise<ValidResponse | ErrorBody> {
  const method = 'avnValidatorsToNominate';
  const params = { callId: call.id };

  return await query(call, request, method, params);
}

async function getMinTotalNominatorStake(call: Call, request: string): Promise<ValidResponse | ErrorBody> {
  return await queryChain(call, request, 'parachainStaking', 'minTotalNominatorStake', [], formatNumAsString);
}

async function getOwnedNfts(call: Call, request: string): Promise<ValidResponse | ErrorBody> {
  const { accountId } = call.params;

  if (isValidAccountId(accountId) === false) {
    return buildErrorBody('params', 'invalid account ID', accountId, request, call.id);
  } else {
    let nfts = await queryChain(call, request, 'nftManager', 'nfts', ['entries']);
    nfts.result = nfts.result.filter(nft => nft[1].owner === accountId).map(nft => toBnString(nft[1].nftId));
    return nfts;
  }
}

async function getStakingStats(call: Call, request: string): Promise<ValidResponse | ErrorBody> {
  const method = 'avnStakingStats';
  const params = { callId: call.id };

  return await query(call, request, method, params);
}

async function getStakerRewardsEarned(call: Call, request: string): Promise<ValidResponse | ErrorBody> {
  let { accountId, fromTimestamp, toTimestamp } = call.params;

  if (!isValidAccountId(accountId)) {
    return buildErrorBody('params', 'invalid account ID', accountId, request, call.id);
  } else {
    try {
      const account = convertToPublicKey(accountId);
      const eventsLimit = 500;
      let events = [],
        sumRewards = new BN(0);

      let fromTimestampDate = parseInt(fromTimestamp ?? '0') > 0 ? new Date(parseInt(fromTimestamp) * 1000 - 1) : new Date(0);
      let toTimestampDate = parseInt(toTimestamp ?? '0') > 0 ? new Date(parseInt(toTimestamp) * 1000) : new Date(32503679999000); // 31/12/2999
      let formattedFromTimestamp = fromTimestampDate.toISOString();
      let formattedToTimestamp = toTimestampDate.toISOString();

      do {
        const query = `query GatewayApiStakerRewardsEarned { events (where: { name_eq: "ParachainStaking.Rewarded",
          args_jsonContains: ${JSON.stringify(JSON.stringify({ account }))},
          block: { timestamp_gt: "${formattedFromTimestamp}", timestamp_lte: "${formattedToTimestamp}"}},
          limit: ${eventsLimit}, orderBy: id_ASC) { args block { timestamp } } }`;
        const response = await axios.post(BLOCK_EXPLORER_BASE_URL, {
          query,
          operationName: 'GatewayApiStakerRewardsEarned'
        });
        events = response.data.data.events;
        if (events.length > 0) {
          events.forEach(event => (sumRewards = sumRewards.add(new BN(event.args.rewards))));
          formattedFromTimestamp = events[events.length - 1].block.timestamp;
        }
      } while (events.length === eventsLimit);

      return buildValidResponseBody(call.id, sumRewards.toString());
    } catch (err) {
      return buildErrorBody('internal', err.toString(), err.toString(), request, call.id);
    }
  }
}

async function getCurrentBlock(call: Call, request: string): Promise<ValidResponse | ErrorBody> {
  const method = 'avnCurrentBlock';
  const params = { callId: call.id };

  return await query(call, request, method, params);
}

async function getChainInfo(call: Call, request: string, filter?: (data: any) => any): Promise<ValidResponse | ErrorBody> {
  const method = 'avnChainInfo';
  const params = { callId: call.id };

  return await query(call, request, method, params, filter);
}

async function isHandlerRegistered(call: Call, request: string): Promise<ValidResponse | ErrorBody> {
  const { handler } = call.params
  return await queryChain(call, request, 'avnAnchor', 'chainHandlers', [handler]);
}

async function getAnchorNonce(call: Call, request: string): Promise<ValidResponse | ErrorBody> {
  const { chainId } = call.params;
  return await queryChain(call, request, 'avnAnchor', 'nonces', [parseInt(chainId)]);
}

async function getPredictionMarketsNonce(call: Call, request: string): Promise<ValidResponse | ErrorBody> {
  const { marketId, accountId } = call.params;
  if (marketId){
    return await queryChain(call, request, 'predictionMarkets', 'marketNonces', [accountId, marketId]);
  }
  return await queryChain(call, request, 'predictionMarkets', 'userNonces', [accountId]);
}

async function getHybridRouterNonce(call: Call, request: string): Promise<ValidResponse | ErrorBody> {
  const { marketId, accountId } = call.params;
  return await queryChain(call, request, 'hybridRouter', 'marketNonces', [accountId, marketId]);
}

async function getAssetIdFromEthToken(call: Call, request: string): Promise<ValidResponse | ErrorBody> {
  const { ethTokenAddress } = call.params;
  return await queryChain(call, request, 'assetRegistry', 'ethAddressToAssetId', [ethTokenAddress]);
}

async function query(call: Call, request: string, method: string, params: object = {}, responseFormatter?: (data: any) => any):Promise<ValidResponse|ErrorBody> {
  try {
    const avnResponse = await axios.post(`${AVN_CONNECTOR_ENDPOINT}${method}`, params);
    const result = avnResponse?.data?.error || (responseFormatter ? responseFormatter(avnResponse?.data) : avnResponse?.data);
    return buildValidResponseBody(call.id, result);
  } catch (err: any) {
    return buildErrorBody(
      'internal',
      `failed to invoke ${method} when querying the chain`,
      err,
      request,
      call.id
    );
  }
}

const formatTotal = data => data.total;

const formatNumAsString = data => toBnString(data);

const formatBalanceAsString = data => toBnString(data.data.free);

const formatNftNonceAsString = data => toBnString(data.nonce);

const formatAsNominatingEnum = data => (data ? 'isStaking' : 'isNotStaking');

const formatEraAsString = data => (data ? data.current : 0);

const filterNftOwner = data => (data ? data.owner : null);

const filterAvnContract = data => (data ? data.avnContract : null);

const filterAvtContract = data => (data ? data.avtContract : null);

const formatListingAsString = data => {
  if (!data || data.toString() === 'Unknown') {
    return 'Not listed';
  }

  return data.toString()
}

const formatAsLowerStatus = data => {
  if (data && data === true) { // this is not a bug, true -> Disabled
    return `Disabled`
  }
  return `Enabled`
}

const formatAsNull = data => (data || null)
