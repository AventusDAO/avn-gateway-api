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
  switch (call.method) {
    case 'getAccountNonce':
      return await getAccountNonce(call, request);
    case 'getAccountPaymentNonce':
      return await getAccountPaymentNonce(call, request);
    case 'getAvtBalance':
      return await getAvtBalance(call, request);
    case 'getAvtContractAddress':
      return await getAvtContractAddress(call, request);
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
    case `getAccountInfo`:
      return await getAccountInfo(call, request);

    default:
      return utils.errorResponse('method', 'method not found', call.method, request, call.id);
  }
}

async function getAccountNonce(call, request) {
  const { accountId } = call.params;

  if (utils.isValidAccountId(accountId) === false) {
    return utils.errorResponse('params', 'invalid account ID', accountId, request, call.id);
  } else {
    return await queryChain(call, request, 'tokenManager', 'nonces', [accountId], formatNumAsString);
  }
}

async function getAccountPaymentNonce(call, request) {
  const { accountId } = call.params;

  if (utils.isValidAccountId(accountId) === false) {
    return utils.errorResponse('params', 'invalid account ID', accountId, request, call.id);
  } else {
    return await queryChain(call, request, 'avnProxy', 'paymentNonces', [accountId], formatNumAsString);
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

async function getNftId(call, request) {
  const { externalRef } = call.params;

  if (utils.isValidString(externalRef) === false) {
    return utils.errorResponse('params', 'invalid external ref', externalRef, request, call.id);
  } else {
    return await queryChain(call, request, 'nftManager', 'nfts', ['entries', externalRef], filterNftId);
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
    return await queryChain(call, request, 'nftManager', 'nfts', ['entries', nftId], filterNftOwner);
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
    const result = avnResponse.data;
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

async function getAccountInfo(call, request) {
  const { accountId } = call.params;

  if (utils.isValidAccountId(accountId) === false) {
    return utils.errorResponse('params', 'invalid account ID', accountId, request, call.id);
  } else {
    return await queryAccountInfoFromChain(call, request, accountId, formatJsonAsString);
  }
}

async function queryChain(call, request, palletName, storageName, params, responseFormatter) {
  try {
    const callId = call.id;
    const avnResponse = await utils.axios.post(AVN_CONNECTOR_ENDPOINT + 'avnQuery', {
      callId,
      palletName,
      storageName,
      params
    });
    const result = avnResponse.data.error || responseFormatter(avnResponse.data, params);
    return utils.validResponse(callId, result);
  } catch (err) {
    return utils.errorResponse('internal', 'failed to query chain', err, request, call.id);
  }
}

async function queryAccountInfoFromChain(call, request, accountId, responseFormatter) {
  try {
    const callId = call.id;
    const avnResponse = await utils.axios.post(AVN_CONNECTOR_ENDPOINT + 'avnAccountInfo', {
      callId,
      accountId
    });
    const result = avnResponse.data.error || responseFormatter(avnResponse.data);
    return utils.validResponse(callId, result);
  } catch (err) {
    return utils.errorResponse('internal', 'failed to query account_info from the chain', err, request, call.id);
  }
}


const formatAsString = data => data.toString();

const formatNumAsString = data => utils.toBnString(data);

const formatBalanceAsString = data => utils.toBnString(data.data.free);

const formatNftNonceAsString = data => utils.toBnString(data.nonce);

const formatJsonAsString = data => utils.toJsonString(data);

// TODO: Remove this temporary filter on full blob data once the Block Explorer is handling capturing NFT Ids
const filterNftId = (data, params) => {
  const uniqueExternalRefAsHex = '0x' + Buffer.from(params[1], 'utf8').toString('hex');
  const index = data.findIndex(nft => nft[1].unique_external_ref === uniqueExternalRefAsHex);
  const nftId = index > -1 ? data[index][1].nft_id : undefined;
  return nftId;
};

// TODO: Remove this temporary filter on full blob data once the Block Explorer is handling capturing NFT owners
const filterNftOwner = (data, params) => {
  const index = data.findIndex(nft => nft[1].nft_id === params[1]);
  const owner = index > -1 ? data[index][1].owner : undefined;
  return owner;
};
