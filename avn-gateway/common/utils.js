const crypto = require('crypto');
const axios = require('axios');
const { TypeRegistry } = require('@polkadot/types');
const registry = new TypeRegistry();
const { hexToU8a, isHex, stringToHex, u8aToHex, u8aConcat, isNumber } = require('@polkadot/util');
const { cryptoWaitReady, decodeAddress, encodeAddress, signatureVerify } = require('@polkadot/util-crypto');
const BN = require('bn.js');
const { validate: uuidValidate } = require('uuid');

const AVT_DECIMALS = new BN(10).pow(new BN(18));
const STASH_REWARD_DESTINATION = 'Stash';
const SIGNING_CONTEXT = 'awt_gateway_api';
const FEE_PAYMENT_CONTEXT = 'authorization for proxy payment';
const TX_TYPES = [
  'proxyAvtTransfer',
  'proxyTokenTransfer',
  'proxyConfirmTokenLift',
  'proxyTokenLower',
  'proxyMintSingleNft',
  'proxyListNftOpenForSale',
  'proxyTransferFiatNft',
  'proxyCancelListFiatNft',
  'proxyBond',
  'proxyNominate',
  'proxyIncreaseStake',
  'proxyUnstake',
  'proxyWithdrawUnlocked',
];

let initialised;

async function init() {
  if (!initialised) {
    await cryptoWaitReady();
    initialised = true;
  }
}

const RPC_ERROR = {
  parse: { code: -32700, message: 'Parse error' },
  request: { code: -32600, message: 'Invalid Request' },
  method: { code: -32601, message: 'Method not found' },
  params: { code: -32602, message: 'Invalid params' },
  internal: { code: -32603, message: 'Internal error' }
};

function buildErrorBody(rpcError, gatewayError, error, request, id) {
  const e = new Error();
  const splitStack = e.stack.split('\n');
  const frame = splitStack[2];
  const file = frame.split('.')[0].split('/').reverse()[0];
  const lineNum = frame.split(':').reverse()[1];
  const func = frame.split(' ')[5];
  const ref = file + ' line ' + lineNum + ' (' + func + ')';
  const errorData = error.response ? error.response.data : 'N/A';
  console.error(
    `${gatewayError.toUpperCase()} Ref: ${ref} ID: ${id} Error data: ${errorData} Error details: ${typeof error === 'object' ? JSON.stringify(error) : error}`
  );
  let response = { jsonrpc: '2.0', id };
  response.error = RPC_ERROR[rpcError];
  response.error.data = { gatewayError, request };

  return response;
}

function requestFailed(response) {
  if (response && response.error && response.error.length > 0) {
  	return true;
  }

  return false;
}

function buildValidResponseBody(id, result) {
  return { jsonrpc: '2.0', id, result };
}
function isSplitFeeToken(token) {
  if (!token) return false;

  const payerAddressIsSet = (token.payer || []).length > 0;
  return token.hasPayer === true || payerAddressIsSet === true;
}

function isValidAccountId(accountId) {
  try {
    encodeAddress(isHex(accountId) ? hexToU8a(accountId) : decodeAddress(accountId));
    return true;
  } catch (error) {
    return false;
  }
}

function isValidAmount(amount) {
  return /^\d+$/.test(amount) && !new BN(amount).isZero();
}

function isValidArray(value) {
  return Array.isArray(value);
}

function isValidEthereumAddress(tokenId) {
  return isHex(tokenId) && tokenId.split('').length == 42;
}

function isValidEthereumTransactionHash(transactionHash) {
  return isHex(transactionHash) && transactionHash.split('').length == 66;
}

function isValidEventType(eventType) {
  return [0, 1, 2, 3, 4, 5].includes(eventType);
}

function isValidMarket(market) {
  return [1, 2].includes(market);
}

function isValidNftId(nftId) {
  return isHex(nftId);
}

function isValidNonce(nonce) {
  return /^\d+$/.test(nonce) && new BN(nonce).lt(new BN('ffffffffffffffff', 16));
}

function isValidRequestId(requestId) {
  return uuidValidate(requestId);
}

function isValidSignatureFormat(signature) {
  return isHex(signature);
}

function isValidString(value) {
  return !(value ? value.replace(/\s/g, '').length == 0 : true);
}

function isValidTransactionType(transactionType) {
  return TX_TYPES.includes(transactionType);
}

function isValidNumber(val) {
  return isNumber(parseInt(val));
}

function convertToAddress(accountId) {
  return isHex(accountId) ? encodeAddress(accountId) : accountId;
}

function convertToPublicKey(accountId) {
  return isHex(accountId) ? accountId : u8aToHex(decodeAddress(accountId));
}

function toBnString(val) {
  return typeof val === 'number' || !isHex(val) ? new BN(val).toString() : new BN(val.replace('0x', ''), 16).toString();
}

function toWholeAVT(val) {
  if (val === 0) return val;
  const attoAmount = new BN(val.replace('0x', ''), 16);
  const wholeAmount = attoAmount.div(AVT_DECIMALS);
  return parseInt(wholeAmount.toString());
}

function buildErrorResponse(statusCode, errorMessage, body) {
  return {
    statusCode,
    error: { message: errorMessage },
    body
  };
}

function buildSuccessResponse(body) {
  return {
    statusCode: 200,
    body
  };
}

function verifyAwtTokenSignature(publicKey, issuedAt, signature, hasPayer, payerAddress) {
  const encodedContext = registry.createType('Text', SIGNING_CONTEXT);
  const encodedPublicKey = registry.createType('AccountId', hexToU8a(publicKey));
  const encodedIssuedAt = registry.createType('Text', issuedAt);

  if (!hasPayer && !payerAddress) {
    // this is a legacy token
    const encodedData = u8aConcat(encodedContext.toU8a(false), encodedPublicKey.toU8a(true), encodedIssuedAt.toU8a(false));
    return verifySignatureWithOrWithoutWrapping(encodedData, signature, publicKey);
  } else {
    const encodedHasPayer = registry.createType('bool', hasPayer);
    const encodedPayer = registry.createType('Option<AccountId>', hexToU8a(payerAddress));

    const encodedData = u8aConcat(
      encodedContext.toU8a(false),
      encodedPublicKey.toU8a(true),
      encodedIssuedAt.toU8a(false),
      encodedHasPayer.toU8a(true),
      encodedPayer.toU8a(true)
    );
    return verifySignatureWithOrWithoutWrapping(encodedData, signature, publicKey);
  }
}

function verifySignatureWithOrWithoutWrapping(encodedData, signature, publicKey) {
  const message = u8aToHex(encodedData);
  const wrappedMessage = stringToHex('<Bytes>') + message.substr(2) + stringToHex('</Bytes>').substr(2);
  return signatureVerify(message, signature, publicKey).isValid || signatureVerify(wrappedMessage, signature, publicKey).isValid;
}

function encodeProxyProof(params) {
  const user = registry.createType('AccountId', params.signer);
  const relayer = registry.createType('AccountId', params.relayer);
  const signature = registry.createType('MultiSignature', params.signature);
  return u8aConcat(user.toU8a(true), relayer.toU8a(true), signature.toU8a(false));
}

function hashString(string) {
  return crypto.createHash('sha256').update(string).digest('hex');
}

function getProxyProof(user, relayerAddress, proxySignature) {
  return {
    signer: user,
    relayer: relayerAddress,
    signature: {
      Sr25519: proxySignature
    }
  };
}

async function getRelayerFee(connectorUrl, relayer, user, transactionType) {
  try {
    const avnResponse = await axios.post(connectorUrl + 'relayerFees', {
      relayer,
      user,
      transactionType
    });

    return avnResponse.data.toString();
  } catch (error) {
    throw new Error(`could not get relayer fee: ${error.toString()}`);
  }
}

// Keep alphabetical
module.exports = {
  axios,
  BN,
  encodeProxyProof,
  buildSuccessResponse,
  buildErrorResponse,
  getProxyProof,
  getRelayerFee,
  hashString,
  STASH_REWARD_DESTINATION,
  convertToAddress,
  convertToPublicKey,
  buildErrorBody,
  init,
  isSplitFeeToken,
  isValidAccountId,
  isValidAmount,
  isValidArray,
  isValidEthereumAddress,
  isValidEthereumTransactionHash,
  isValidEventType,
  isValidMarket,
  isValidNftId,
  isValidNonce,
  isValidNumber,
  isValidRequestId,
  isValidSignatureFormat,
  isValidString,
  isValidTransactionType,
  requestFailed,
  signatureVerify,
  stringToHex,
  toBnString,
  toWholeAVT,
  buildValidResponseBody,
  verifyAwtTokenSignature,
  verifySignatureWithOrWithoutWrapping
};
