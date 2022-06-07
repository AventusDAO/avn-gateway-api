const utils = require('/opt/utils.js');

const AVN_CONNECTOR_ENDPOINT = process.env.AVN_CONNECTOR_ENDPOINT;

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
    return utils.errorResponse('parse', 'failed to parse JSON', err, request, null);
  }

  if (call.id === undefined) call.id = null;

  if (typeof call.method !== 'string') {
    return utils.errorResponse('request', 'method type must be string', call.method, request, call.id);
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
    case 'getActiveEra':
      return await queryActiveEra(call, request);
    case 'getOwnedNfts':
      return await getOwnedNfts(call, request);
    case 'getStakingStats':
      return await getStakingStats(call, request);
    case 'getCurrentBlock':
      return await getCurrentBlock(call, request);
    case 'getChainInfo':
      return await getChainInfo(call, request);
    case 'getEraElectionStatus':
      return await queryEraElectionStatus(call, request);
    case 'getSummaryData':
      return await getSummaryData(call, request);
    case 'getSummaryInclusionData':
      return await getSummaryInclusionData(call, request);

    default:
      return utils.errorResponse('method', 'method not found', call.method, request, call.id);
  }
}

async function getNonce(call, request) {
  const { accountId, nonceType } = call.params;

  if (utils.isValidAccountId(accountId) === false) {
    return utils.errorResponse('params', 'invalid account ID', accountId, request, call.id);
  }

  switch (nonceType) {
    case 'token':
      return await queryChain(call, request, 'tokenManager', 'nonces', [accountId], formatNumAsString);
    case 'payment':
      return await queryChain(call, request, 'avnProxy', 'paymentNonces', [accountId], formatNumAsString);
    case 'staking':
      return await queryChain(call, request, 'validatorsManager', 'proxyNonces', [accountId], formatNumAsString);
    case 'confirmation':
      return await queryChain(call, request, 'ethereumEvents', 'proxyNonces', [accountId], formatNumAsString);
    default:
      return utils.errorResponse('params', 'invalid nonce type', nonceType, request, call.id);
  }
}

async function getAvtBalance(call, request) {
  const { accountId } = call.params;

  if (utils.isValidAccountId(accountId) === false) {
    return utils.errorResponse('params', 'invalid account ID', accountId, request, call.id);
  } else {
    return await queryChain(call, request, 'system', 'account', [accountId], formatBalanceAsString);
  }
}

async function getAvtContractAddress(call, request) {
  return await queryChain(call, request, 'tokenManager', 'aVTTokenContract', [], formatAsString);
}

async function getAvnContractAddress(call, request) {
  return await queryChain(call, request, 'ethereumEvents', 'liftingContractAddress', [], formatAsString);
}

async function getNftContractAddress(call, request) {
  const method = 'avnNftContractAddresses';
  return await query(call, request, method, {}, formatAsString);
}

async function getNftId(call, request) {
  const { externalRef } = call.params;

  if (utils.isValidString(externalRef) === false) {
    return utils.errorResponse('params', 'invalid external ref', externalRef, request, call.id);
  } else {
    function getNftIdFunction(externalRef) {
      return function (nftData) {
        return filterNftId(externalRef, nftData);
      };
    }
    return await queryChain(call, request, 'nftManager', 'nfts', ['entries', externalRef], getNftIdFunction(externalRef));
  }
}

async function getNftNonce(call, request) {
  const { nftId } = call.params;

  if (utils.isValidNftId(nftId) === false) {
    return utils.errorResponse('params', 'invalid nft id', nftId, request, call.id);
  } else {
    return await queryChain(call, request, 'nftManager', 'nfts', [nftId], formatNftNonceAsString);
  }
}

async function getNftOwner(call, request) {
  const { nftId } = call.params;

  if (utils.isValidNftId(nftId) === false) {
    return utils.errorResponse('params', 'invalid nft id', nftId, request, call.id);
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
    return utils.errorResponse('params', gatewayError, call.params, request, call.id);
  }

  try {
    relayer = utils.convertToAddress(relayer);
    user = utils.convertToAddress(user);
    const avnResponse = await utils.axios.post(AVN_CONNECTOR_ENDPOINT + 'relayerFees', { relayer, user, transactionType });
    let result = avnResponse.data;
    result = typeof result === 'number' ? result.toString() : result;
    return utils.validResponse(call.id, result);
  } catch (err) {
    return utils.errorResponse('internal', err.response.data.error, err, request, call.id);
  }
}

async function getTokenBalance(call, request) {
  const { accountId, token } = call.params;

  try {
    if (utils.isValidAccountId(accountId) === false) throw 'account ID';
    if (utils.isValidEthereumAddress(token) === false) throw 'token';
  } catch (param) {
    const gatewayError = 'invalid ' + param;
    return utils.errorResponse('params', gatewayError, call.params, request, call.id);
  }

  return await queryChain(call, request, 'tokenManager', 'balances', [[token, accountId]], formatNumAsString);
}

async function getTotalAvt(call, request) {
  return await queryChain(call, request, 'balances', 'totalIssuance', [], formatNumAsString);
}

async function getTotalToken(call, request) {
  const { token } = call.params;

  if (utils.isValidEthereumAddress(token) === false) {
    return utils.errorResponse('params', 'invalid token', token, request, call.id);
  } else {
    const method = 'avnTotalToken';
    const params = { callId: call.id, token };
    return await query(call, request, method, params, formatTotal);
  }
}

async function getAccountInfo(call, request) {
  const { accountId } = call.params;

  if (utils.isValidAccountId(accountId) === false) {
    return utils.errorResponse('params', 'invalid account ID', accountId, request, call.id);
  } else {
    return await queryAccountInfoFromChain(call, request, accountId);
  }
}

async function queryActiveEra(call, request) {
  return await queryChain(call, request, 'staking', 'activeEra', [], formatEraAsString);
}

async function queryEraElectionStatus(call, request) {
  return await queryChain(call, request, 'staking', 'eraElectionStatus', [], formatEraElectionStatus);
}

async function queryChain(call, request, palletName, storageName, params, responseFormatter) {
  const method = 'avnQuery';
  const requestParams = { callId: call.id, palletName, storageName, params };

  return await query(call, request, method, requestParams, responseFormatter);
}

async function getStakingStatus(call, request) {
  const { accountId } = call.params;

  if (utils.isValidAccountId(accountId) === false) {
    return utils.errorResponse('params', 'invalid account ID', accountId, request, call.id);
  } else {
    return await queryChain(call, request, 'staking', 'nominators', [accountId], formatAsNominatingEnum);
  }
}

async function queryAccountInfoFromChain(call, request, accountId) {
  const method = 'avnAccountInfo';
  const params = { callId: call.id, accountId };

  return await query(call, request, method, params);
}

async function queryValidatorsToNominateFromChain(call, request) {
  const method = 'avnValidatorsToNominate';
  const params = { callId: call.id };

  return await query(call, request, method, params);
}

async function getOwnedNfts(call, request) {
  const { accountId } = call.params;

  if (utils.isValidAccountId(accountId) === false) {
    return utils.errorResponse('params', 'invalid account ID', accountId, request, call.id);
  } else {
    return await queryChain(call, request, 'nftManager', 'ownedNfts', [accountId]);
  }
}

async function getStakingStats(call, request) {
  const method = 'avnStakingStats';
  const params = { callId: call.id };

  return await query(call, request, method, params);
}

async function getCurrentBlock(call, request) {
  const method = 'avnCurrentBlock';
  const params = { callId: call.id };

  return await query(call, request, method, params);
}

async function getChainInfo(call, request) {
  const method = 'avnChainInfo';
  const params = { callId: call.id };

  return await query(call, request, method, params);
}

async function getSummaryData(call, request) {
  const { blockNumber } = call.params;
  if (blockNumber && utils.isValidNumber(blockNumber) === false) {
    return utils.errorResponse('params', 'invalid block number', blockNumber, request, call.id);
  }
  const method = 'avnSummaryData';
  const params = { callId: call.id, blockNumber };
  return await query(call, request, method, params);
}

async function getSummaryInclusionData(call, request) {
  const { blockNumber, transactionIndex } = call.params;

  try {
    if (utils.isValidNumber(blockNumber) === false) throw 'block number';
    if (utils.isValidNumber(transactionIndex) === false) throw 'transaction index';
  } catch (param) {
    const gatewayError = 'invalid ' + param;
    return utils.errorResponse('params', gatewayError, call.params, request, call.id);
  }

  const method = 'avnSummaryInclusionData';
  const params = { callId: call.id, blockNumber, transactionIndex };
  return await query(call, request, method, params);
}

async function query(call, request, method, params, responseFormatter) {
  try {
    const avnResponse = await utils.axios.post(AVN_CONNECTOR_ENDPOINT + method, params);
    const result =
      (avnResponse.data && avnResponse.data.error) ||
      (responseFormatter ? responseFormatter(avnResponse.data) : avnResponse.data);
    return utils.validResponse(call.id, result);
  } catch (err) {
    return utils.errorResponse('internal', `failed to invoke ${method} when querying the chain`, err, request, call.id);
  }
}

const formatTotal = data => data.total;

const formatAsString = data => data.toString();

const formatNumAsString = data => utils.toBnString(data);

const formatBalanceAsString = data => utils.toBnString(data.data.free);

const formatNftNonceAsString = data => utils.toBnString(data.nonce);

const formatAsNominatingEnum = data => (data ? 'isStaking' : 'isNotStaking');

const formatEraAsString = data => (data ? data.index : 0);

const formatEraElectionStatus = data => (Object.keys(data)[0] === 'Open' ? 'isOpen' : 'isClosed');

const filterNftOwner = data => (data ? data.owner : null);

// TODO: Remove this temporary filter on full blob data once the Block Explorer is handling capturing NFT Ids
const filterNftId = (uniqueExternalRef, data) => {
  const uniqueExternalRefAsHex = '0x' + Buffer.from(uniqueExternalRef, 'utf8').toString('hex');
  const index = data.findIndex(nft => nft[1].unique_external_ref === uniqueExternalRefAsHex);
  const nftId = index > -1 ? data[index][1].nft_id : undefined;
  return nftId;
};
