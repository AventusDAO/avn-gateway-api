const utils = require('/opt/utils.js');

const AVN_CONNECTOR_ENDPOINT = process.env.AVN_CONNECTOR_ENDPOINT;
const BLOCK_EXPLORER_BASE_URL = process.env.BLOCK_EXPLORER_BASE_URL;

exports.handler = async event => {
  return {
    statusCode: 200,
    body: JSON.stringify(await processRequest(event.body))
  };
};

async function processRequest(request) {
  let call;

  try {
    call = JSON.parse(request);
  } catch (err) {
    return utils.buildErrorBody('parse', 'failed to parse JSON', err.toString(), request, null);
  }

  if (call.id === undefined) call.id = null;

  if (typeof call.method !== 'string') {
    return utils.buildErrorBody('request', 'method type must be string', call.method, request, call.id);
  } else {
    return await callSwitch(call, request);
  }
}

// Keep alphabetical
async function callSwitch(call, request) {
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

    default:
      return utils.buildErrorBody('method', 'method not found', call.method, request, call.id);
  }
}

async function getNonce(call, request) {
  const { accountId, nonceType } = call.params;

  if (utils.isValidAccountId(accountId) === false) {
    return utils.buildErrorBody('params', 'invalid account ID', accountId, request, call.id);
  }

  if (nonceType in utils.NONCE_INFO === false) {
    return utils.buildErrorBody('params', 'invalid nonce type', nonceType, request, call.id);
  }

  const { palletName, storageName } = utils.NONCE_INFO[nonceType];

  return await queryChain(call, request, palletName, storageName, [accountId], formatNumAsString);
}

async function getAvtBalance(call, request) {
  const { accountId } = call.params;

  if (utils.isValidAccountId(accountId) === false) {
    return utils.buildErrorBody('params', 'invalid account ID', accountId, request, call.id);
  } else {
    return await queryChain(call, request, 'system', 'account', [accountId], formatBalanceAsString);
  }
}

async function getAvtContractAddress(call, request) {
  return await getChainInfo(call, request, filterAvtContract);
}

async function getAvnContractAddress(call, request) {
  return await getChainInfo(call, request, filterAvnContract);
}

async function getDefaultRelayer(call, request) {
  const method = 'getDefaultRelayer';
  const params = { callId: call.id };
  return await query(call, request, method, params);
}

async function getNftContractAddress(call, request) {
  const method = 'avnNftContractAddresses';
  return await query(call, request, method, {});
}

async function getNftId(call, request) {
  const { externalRef } = call.params;

  if (utils.isValidString(externalRef) === false) {
    return utils.buildErrorBody('params', 'invalid external ref', externalRef, request, call.id);
  }

  try {
    const uniqueExternalRef = '0x' + Buffer.from(externalRef, 'utf8').toString('hex');
    const callArgs = { uniqueExternalRef };
    const proxyArgs = { call: { value: callArgs } };
    const query = `query GatewayApiNftId { events (where: { name_eq: "NftManager.SingleNftMinted",
        call: { args_jsonContains: ${JSON.stringify(JSON.stringify(callArgs))},
        OR: { args_jsonContains: ${JSON.stringify(JSON.stringify(proxyArgs))} } } }, limit: 1) { args } }`;
    const response = await utils.axios.post(BLOCK_EXPLORER_BASE_URL, { query, operationName: 'GatewayApiNftId' });
    const events = response.data.data.events;
    const nftId = events.length === 1 ? events[0].args.nftId : '';
    return utils.buildValidResponseBody(call.id, nftId);
  } catch (err) {
    return utils.buildErrorBody('internal', err, err.toString(), request, call.id);
  }
}

async function getNftNonce(call, request) {
  const { nftId } = call.params;

  if (utils.isValidNftId(nftId) === false) {
    return utils.buildErrorBody('params', 'invalid nft id', nftId, request, call.id);
  } else {
    const { palletName, storageName } = utils.NONCE_INFO.nft;
    return await queryChain(call, request, palletName, storageName, [nftId], formatNftNonceAsString);
  }
}

async function getNftInfo(call, request) {
  const { nftId } = call.params;

  if (utils.isValidNftId(nftId) === false) {
    return utils.buildErrorBody('params', 'invalid nft id', nftId, request, call.id);
  } else {
    const method = 'getNftInfo';
    const params = { callId: call.id, nftId };
    return await query(call, request, method, params);
  }
}

async function getBatchInfo(call, request) {
  const { batchId } = call.params;

  if (utils.isValidNftId(batchId) === false) {
    return utils.buildErrorBody('params', 'invalid batch id', batchId, request, call.id);
  } else {
    const method = 'getBatchInfo';
    const params = { callId: call.id, batchId };
    return await query(call, request, method, params);
  }
}

async function getNftListingStatus(call, request) {
  const { nftId } = call.params;

  if (utils.isValidNftId(nftId) === false) {
    return utils.buildErrorBody('params', 'invalid nft id', nftId, request, call.id);
  } else {
    return await queryChain(call, request, 'nftManager', 'nftOpenForSale', [nftId], formatListingAsString);
  }
}

async function getBatchListingStatus(call, request) {
  const { batchId } = call.params;

  // NftIs and BatchId have the same format
  if (utils.isValidNftId(batchId) === false) {
    return utils.buildErrorBody('params', 'invalid batch id', batchId, request, call.id);
  } else {
    return await queryChain(call, request, 'nftManager', 'batchOpenForSale', [batchId], formatListingAsString);
  }
}

async function getNftOwner(call, request) {
  const { nftId } = call.params;

  if (utils.isValidNftId(nftId) === false) {
    return utils.buildErrorBody('params', 'invalid nft id', nftId, request, call.id);
  } else {
    return await queryChain(call, request, 'nftManager', 'nfts', [nftId], filterNftOwner);
  }
}

async function getRelayerFees(call, request) {
  let { relayer, user, transactionType } = call.params;

  try {
    if (utils.isValidAccountId(relayer) === false) throw 'relayer';
    if (user && utils.isValidAccountId(user) === false) throw 'user';
    if (transactionType && utils.isValidTransactionType(transactionType) === false) throw 'transaction type';
  } catch (param) {
    const gatewayError = 'invalid ' + param;
    return utils.buildErrorBody('params', gatewayError, call.params, request, call.id);
  }

  try {
    relayer = utils.convertToAddress(relayer);
    user = utils.convertToAddress(user);
    const avnResponse = await utils.axios.post(AVN_CONNECTOR_ENDPOINT + 'relayerFees', { relayer, user, transactionType });
    let result = avnResponse.data;
    result = typeof result === 'number' ? result.toString() : result;
    return utils.buildValidResponseBody(call.id, result);
  } catch (err) {
    return utils.buildErrorBody('internal', err.response.data.error, err.toString(), request, call.id);
  }
}

async function getTokenBalance(call, request) {
  const { accountId, token } = call.params;

  try {
    if (utils.isValidAccountId(accountId) === false) throw 'account ID';
    if (utils.isValidEthereumAddress(token) === false) throw 'token';
  } catch (param) {
    const gatewayError = 'invalid ' + param;
    return utils.buildErrorBody('params', gatewayError, call.params, request, call.id);
  }

  return await queryChain(call, request, 'tokenManager', 'balances', [[token, accountId]], formatNumAsString);
}

async function getTotalAvt(call, request) {
  return await queryChain(call, request, 'balances', 'totalIssuance', [], formatNumAsString);
}

async function getTotalToken(call, request) {
  const { token } = call.params;

  if (utils.isValidEthereumAddress(token) === false) {
    return utils.buildErrorBody('params', 'invalid token', token, request, call.id);
  } else {
    const method = 'avnTotalToken';
    const params = { callId: call.id, token };
    return await query(call, request, method, params, formatTotal);
  }
}

async function getAccountInfo(call, request) {
  const { accountId } = call.params;

  if (utils.isValidAccountId(accountId) === false) {
    return utils.buildErrorBody('params', 'invalid account ID', accountId, request, call.id);
  } else {
    return await queryAccountInfoFromChain(call, request, accountId);
  }
}

async function queryActiveEra(call, request) {
  return await queryChain(call, request, 'parachainStaking', 'era', [], formatEraAsString);
}

async function queryStakingDelay(call, request) {
  return await queryChain(call, request, 'parachainStaking', 'delay', []);
}

async function queryChain(call, request, palletName, storageName, params, responseFormatter) {
  const method = 'avnQuery';
  const requestParams = { callId: call.id, palletName, storageName, params };

  return await query(call, request, method, requestParams, responseFormatter);
}

async function getStakingStatus(call, request) {
  const { accountId } = call.params;

  if (utils.isValidAccountId(accountId) === false) {
    return utils.buildErrorBody('params', 'invalid account ID', accountId, request, call.id);
  } else {
    return await queryChain(call, request, 'parachainStaking', 'nominatorState', [accountId], formatAsNominatingEnum);
  }
}

async function queryAccountInfoFromChain(call, request, accountId) {
  const method = 'avnAccountInfo';
  const params = { callId: call.id, accountId };

  return await query(call, request, method, params);
}

async function getEthereumEventStatus(call, request) {
  const method = 'ethereumEventStatus';
  let { liftStatus } = (await query(call, request, method)).data;

  console.info(`Checked Ethereum event status: ${liftStatus}`);

  return liftStatus;
}

async function queryValidatorsToNominateFromChain(call, request) {
  const method = 'avnValidatorsToNominate';
  const params = { callId: call.id };

  return await query(call, request, method, params);
}

async function getMinTotalNominatorStake(call, request) {
  return await queryChain(call, request, 'parachainStaking', 'minTotalNominatorStake', [], formatNumAsString);
}

async function getOwnedNfts(call, request) {
  const { accountId } = call.params;

  if (utils.isValidAccountId(accountId) === false) {
    return utils.buildErrorBody('params', 'invalid account ID', accountId, request, call.id);
  } else {
    let nfts = await queryChain(call, request, 'nftManager', 'nfts', ['entries']);
    nfts.result = nfts.result.filter(nft => nft[1].owner === accountId).map(nft => utils.toBnString(nft[1].nftId));
    return nfts;
  }
}

async function getStakingStats(call, request) {
  const method = 'avnStakingStats';
  const params = { callId: call.id };

  return await query(call, request, method, params);
}

async function getStakerRewardsEarned(call, request) {
  let { accountId, fromTimestamp, toTimestamp } = call.params;

  if (utils.isValidAccountId(accountId) === false) {
    return utils.buildErrorBody('params', 'invalid account ID', accountId, request, call.id);
  } else {
    try {
      const account = utils.convertToPublicKey(accountId);
      const eventsLimit = 500;
      let events = [],
        sumRewards = new utils.BN(0);

      fromTimestamp = parseInt(fromTimestamp) > 0 ? new Date(parseInt(fromTimestamp) * 1000 - 1) : new Date(0);
      toTimestamp = parseInt(toTimestamp) > 0 ? new Date(parseInt(toTimestamp) * 1000) : new Date(32503679999000); // 31/12/2999
      fromTimestamp = fromTimestamp.toISOString();
      toTimestamp = toTimestamp.toISOString();

      do {
        const query = `query GatewayApiStakerRewardsEarned { events (where: { name_eq: "ParachainStaking.Rewarded",
          args_jsonContains: ${JSON.stringify(JSON.stringify({ account }))},
          block: { timestamp_gt: "${fromTimestamp}", timestamp_lte: "${toTimestamp}"}},
          limit: ${eventsLimit}, orderBy: id_ASC) { args block { timestamp } } }`;
        const response = await utils.axios.post(BLOCK_EXPLORER_BASE_URL, {
          query,
          operationName: 'GatewayApiStakerRewardsEarned'
        });
        events = response.data.data.events;
        if (events.length > 0) {
          events.forEach(event => (sumRewards = sumRewards.add(new utils.BN(event.args.rewards))));
          fromTimestamp = events[events.length - 1].block.timestamp;
        }
      } while (events.length === eventsLimit);

      return utils.buildValidResponseBody(call.id, sumRewards.toString());
    } catch (err) {
      return utils.buildErrorBody('internal', err.toString(), err.toString(), request, call.id);
    }
  }
}

async function getCurrentBlock(call, request) {
  const method = 'avnCurrentBlock';
  const params = { callId: call.id };

  return await query(call, request, method, params);
}

async function getChainInfo(call, request, filter) {
  const method = 'avnChainInfo';
  const params = { callId: call.id };

  return await query(call, request, method, params, filter);
}

async function query(call, request, method, params, responseFormatter) {
  try {
    const avnResponse = await utils.axios.post(AVN_CONNECTOR_ENDPOINT + method, params);
    const result =
      (avnResponse.data && avnResponse.data.error) ||
      (responseFormatter ? responseFormatter(avnResponse.data) : avnResponse.data);
    return utils.buildValidResponseBody(call.id, result);
  } catch (err) {
    return utils.buildErrorBody(
      'internal',
      `failed to invoke ${method} when querying the chain`,
      err.toString(),
      request,
      call.id
    );
  }
}

const formatTotal = data => data.total;

const formatAsString = data => data.toString();

const formatNumAsString = data => utils.toBnString(data);

const formatBalanceAsString = data => utils.toBnString(data.data.free);

const formatNftNonceAsString = data => utils.toBnString(data.nonce);

const formatAsNominatingEnum = data => (data ? 'isStaking' : 'isNotStaking');

const formatEraAsString = data => (data ? data.current : 0);

const filterNftOwner = data => (data ? data.owner : null);

const filterAvnContract = data => (data ? data.avnContract : null);

const filterAvtContract = data => (data ? data.avtContract : null);

const formatListingAsString = data => {
  if (!data || data.toString() === 'Unknown') {
    return 'Not listed'
  }

  return data.toString()
}
