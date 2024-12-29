
import * as crypto from 'crypto';
import axios from 'axios';
import { TypeRegistry } from '@polkadot/types';
import {
  hexToU8a, isHex, stringToHex, u8aToHex, u8aConcat,
} from '@polkadot/util';
import { cryptoWaitReady, decodeAddress, encodeAddress, signatureVerify } from '@polkadot/util-crypto';
const { BN } = require('bn.js');
import { validate as uuidValidate } from 'uuid';
import { InterfaceTypes } from '@polkadot/types/types';
import { DataItem, ErrorBody, ErrorResponse, ExtendedInterfaceTypes, NonceInfo, ProxyProof, RPCError, RPCResponse, Response, Royalty, SuccessResponse, Token, Transaction,
  TransactionType } from './types';

const registry = new TypeRegistry();
const customTypes = {
  "BlockRange": {
    "start": "BlockNumber",
    "end": "BlockNumber"
  },
  "TimeRange": {
    "start": "Moment",
    "end": "Moment"
  },
  "MarketPeriod": {
    "_enum": {
      "Block": "BlockRange",
      "Timestamp": "TimeRange"
    }
  },
  "AssetOf": "Asset<MarketId>",
  "MarketPeriodOf": "MarketPeriod<BlockNumber, Moment>",
  "DeadlinePeriodOf": "Deadlines<BlockNumber>",
  "MarketId" : "u128",
  "CategoryIndex": "u16",
  "PoolId": "u128",
  "MultiHash": {
    "_enum": {
      "Sha3_384": "[u8; 50]",
    }
  },
  "Asset" : {
    "_enum": {
      "CategoricalOutcome" : "(MarketId, CategoryIndex)",
      "ScalarOutcome": "(MarketId, ScalarPosition)",
      "CombinatorialOutcome": null,
      "PoolShare": "PoolId",
      "Vow": null,
      "ForeignAsset": "u32",
      "ParimutuelShare": "(MarketId, CategoryIndex)",
    }
  },
  "ScalarPosition" : {
    "_enum": {
      "Long": null,
      "Short": null
    }
  },
  "MarketType": {
    "_enum": {
      /// A market with a number of categorical outcomes.
      "Categorical": "u16"
    }
  },
  "MarketDisputeMechanism": {
    "_enum": {
    "Authorized": null,
    "Court": null,
    }
  },
  "Deadlines" : {
    "grace_period": "BlockNumber",
    "oracle_duration": "BlockNumber",
    "dispute_duration": "BlockNumber",
  },
  "Strategy": {
    "_enum": {
      "ImmediateOrCancel": null,
      "LimitOrder": null,
    }
  },
  "OutcomeReport": {
    "_enum": {
      "Categorical": "CategoryIndex",
      "Scalar": "u128",
    }
  }
};

// Register these custom types so the registry knows how to decode/encode them
registry.register(customTypes);

const EXECUTION_MARGIN = 1000;
const AVT_DECIMALS = new BN(10).pow(new BN(18));
const STASH_REWARD_DESTINATION = 'Stash';
const SIGNING_CONTEXT = 'awt_gateway_api';
const NUM_TYPES = [
  'AccountId', 'Balance', 'BalanceOf', 'EraIndex', 'u8', 'u16', 'u32', 'u64', 'u128',
  'U256', 'H160', 'H256', 'BlockNumber', 'PoolId', 'CategoryIndex', 'MarketId',
];

enum WEBHOOK_EVENT_TYPES {
  tx_received = 'tx_received',
  tx_payer_accepted = 'tx_payer_accepted',
  tx_queued = 'tx_queued',
  tx_ready = 'tx_ready',
  tx_sent = 'tx_sent',
  tx_payer_refused = 'tx_payer_refused',
  tx_send_failed = 'tx_send_failed',
  tx_execution_failed = 'tx_execution_failed',
  tx_succeeded = 'tx_succeeded'
}

const NONCE_INFO: NonceInfo = {
  batch: { palletName: 'nftManager', storageName: 'batchNonces' },
  confirmation: { palletName: 'ethereumEvents', storageName: 'proxyNonces' },
  nft: { palletName: 'nftManager', storageName: 'nfts' },
  payment: { palletName: 'avnProxy', storageName: 'paymentNonces' },
  staking: { palletName: 'parachainStaking', storageName: 'proxyNonces' },
  token: { palletName: 'tokenManager', storageName: 'nonces' },
  anchor: { palletName: 'avnAnchor', storageName: 'nonces' },
  predictionMarkets: { palletName: 'predictionMarkets', storageName: 'marketNonces' },
  hybridRouter: { palletName: 'hybridRouter', storageName: 'nonces' }
};

const VAULT_PAYER_USERNAME_PREFIX = 'GatewayPayer_';

let initialised;

async function init() {
  if (!initialised) {
    await cryptoWaitReady();
    initialised = true;
  }
}

const RPC_ERROR: RPCError = {
  parse: { code: -32700, message: 'Parse error' },
  request: { code: -32600, message: 'Invalid Request' },
  method: { code: -32601, message: 'Method not found' },
  params: { code: -32602, message: 'Invalid params' },
  internal: { code: -32603, message: 'Internal error' }
};

function buildErrorBody(rpcError: keyof RPCError, gatewayError: string = '', error: any = {}, request: any, id: string): ErrorBody {
  const e = new Error();
  const splitStack = e.stack.split('\n');
  const frame = splitStack[2];
  const file = frame.split('.')[0].split('/').reverse()[0];
  const lineNum = frame.split(':').reverse()[1];
  const func = frame.split(' ')[5];
  const ref = file + ' line ' + lineNum + ' (' + func + ')';
  const errorData = error.response ? error.response.data?.error : 'N/A';
  console.error(
    `${gatewayError.toUpperCase()} Ref: ${ref} ID: ${id} Error data: ${errorData} Error details: ${typeof error === 'object' ? JSON.stringify(error) : error
    }`
  );
  let response: ErrorBody = { jsonrpc: '2.0', id };
  response.error = RPC_ERROR[rpcError];
  response.error.data = { gatewayError, request };

  return response;
}

function requestFailed(response: Response): boolean {
  return !!(response && response.error && Object.keys(response.error).length > 0);
}

function buildValidResponseBody<T>(id: string, result: T): RPCResponse<T> {
  return { jsonrpc: '2.0', id, result };
}

function isSplitFeeToken(token: Token): boolean {
  if (!token) return false;

  const payerAddressIsSet = (token.payer || []).length > 0;
  return token.hasPayer === true || payerAddressIsSet === true;
}

function isSplitFeeTransaction(tx: Transaction): boolean {
  return !!tx.splitFeePayerAddress && isValidAccountId(tx.splitFeePayerAddress);
}

function isValidAccountId(accountId: string): boolean {
  try {
    encodeAddress(isHex(accountId) ? hexToU8a(accountId) : decodeAddress(accountId));
    return true;
  } catch (error) {
    return false;
  }
}

function isValidAmount(amount: string): boolean {
  return /^\d+$/.test(amount) && !new BN(amount).isZero();
}

function isValidEthereumAddress(tokenId: string): boolean {
  return isHex(tokenId) && tokenId.split('').length == 42;
}

function isValidEthereumTransactionHash(transactionHash: string): boolean {
  return isHex(transactionHash) && transactionHash.split('').length == 66;
}

function isValidNftId(nftId: string | typeof BN): boolean {
  nftId = new BN(nftId).toString(16);
  return nftId.length <= 64;
}

function isValidNonce(nonce: string): boolean {
  return /^\d+$/.test(nonce) && new BN(nonce).lt(new BN('ffffffffffffffff', 16));
}

function isValidRequestId(requestId: string): boolean {
  return uuidValidate(requestId);
}

function isValidSignatureFormat(signature: string): boolean {
  return isHex(signature);
}

function isValidString(value: string): boolean {
  return !(value ? value.replace(/\s/g, '').length === 0 : true);
}

function isValidCurrencyFormat(value: string): boolean {
  return isHex(value) && hexToU8a(value).length === 20;
}

function convertToAddress(accountId: string | String | Uint8Array): string {
  if (accountId instanceof String) {
    accountId = accountId.toString();
  }
  if (typeof accountId === 'string') {
    return isHex(accountId) ? encodeAddress(accountId) : accountId;
  } else {
    throw new TypeError("Expected a string or String object for accountId");
  }
}

function convertToPublicKey(accountId: string): string {
  return isHex(accountId) ? accountId : u8aToHex(decodeAddress(accountId));
}

function toBnString(val: number | typeof BN): string {
  return typeof val === 'number' || !isHex(val) ? new BN(val).toString() : new BN(val.replace('0x', ''), 16).toString();
}

function toWholeAVT(val: string | number): number {
  if (val === 0) return val;
  const valueStr = typeof val === 'number' ? val.toString() : val;
  const attoAmount = new BN(valueStr.replace('0x', ''), 16);
  const wholeAmount = attoAmount.div(AVT_DECIMALS);
  return parseInt(wholeAmount.toString());
}

function buildErrorResponse(statusCode: number, errorMessage: string, body: any): ErrorResponse {
  return {
    statusCode,
    error: { message: errorMessage },
    body
  };
}

function buildSuccessResponse(body: any): SuccessResponse {
  return {
    statusCode: 200,
    body
  };
}

function verifyAwtTokenSignature(publicKey: string, issuedAt: string, signature: string, hasPayer: boolean, payerAddress: string): boolean {
  const encodedContext = registry.createType('Text', SIGNING_CONTEXT);
  const encodedPublicKey = registry.createType('AccountId', hexToU8a(publicKey));
  const encodedIssuedAt = registry.createType('Text', issuedAt);

  if (!hasPayer && !payerAddress) {
    // this is a legacy token
    const encodedData = u8aConcat(encodedContext.toU8a(false), encodedPublicKey.toU8a(true), encodedIssuedAt.toU8a(false));
    return verifySignatureWithOrWithoutWrapping(encodedData, signature, publicKey);
  } else {
    const encodedHasPayer = registry.createType('bool', hasPayer);
    const encodedPayer = registry.createType('Option<AccountId>', payerAddress);

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

function verifySignatureWithOrWithoutWrapping(encodedData: Uint8Array, signature: string, publicKey: string): boolean {
  const message = u8aToHex(encodedData);
  const wrappedMessage = stringToHex('<Bytes>') + message.substr(2) + stringToHex('</Bytes>').substr(2);
  return (
    signatureVerify(message, signature, publicKey).isValid || signatureVerify(wrappedMessage, signature, publicKey).isValid
  );
}

function encodeProxyProof(params: ProxyProof): Uint8Array {
  const user = registry.createType('AccountId', params.signer);
  const relayer = registry.createType('AccountId', params.relayer);
  const signature = registry.createType('MultiSignature', params.signature);
  return u8aConcat(user.toU8a(true), relayer.toU8a(true), signature.toU8a(false));
}

function hashString(string: string): string {
  return crypto.createHash('sha256').update(string).digest('hex');
}

function getProxyProof(user: string, relayerAddress: string, proxySignature: string): ProxyProof {
  return {
    signer: user,
    relayer: relayerAddress,
    signature: {
      Sr25519: proxySignature
    }
  };
}

async function getRelayerFee(connectorUrl: string, relayer: string, user: string, transactionType: TransactionType, currencyToken: string): Promise<string> {
  try {
    const avnResponse = await axios.post(connectorUrl + 'relayerFees', {
      relayer,
      user,
      transactionType,
      currencyToken
    });

    return avnResponse.data.toString();
  } catch (error) {
    console.error(`could not get relayer fee for relayer: ${relayer}, user: ${user}, transactionType: ${transactionType}, currencyToken: ${currencyToken}: `, error)
    throw error;
  }
}

async function publishEvent(connectorUrl:string, eventType:string, requestId:string, accountId:string, data:any):Promise<void> {
  try {
    if (isValidString(eventType) === false) throw 'missing eventType';
    if (isValidRequestId(requestId) === false) throw 'missing requestId';
    if (isValidAccountId(accountId) === false) throw 'missing accountId';
    if (typeof data !== 'object' || data === null) throw 'missing data';
    await axios.post(connectorUrl + 'publishEvent', { eventType, requestId, accountId, data });
  } catch (error) {
    throw new Error(`Error publishing webhook event: ${error.toString()}`);
  }
}

function getPayerVaultUsername(payerVaultId:string):string {
  return `${VAULT_PAYER_USERNAME_PREFIX}${payerVaultId}`;
}

function isValidArray(value) {
  return Array.isArray(value);
}

function isValidProxySignature(proxySignature:string, user:string, data:any[]):boolean {
  const encodedData = encodeOrderedData(data);
  return verifySignatureWithOrWithoutWrapping(encodedData, proxySignature, user);
}

function encodeOrderedData(data:DataItem[]):Uint8Array {
  const encodedDataToSign = data.map(d => {
    const [type, value] = Object.entries(d)[0] as [ExtendedInterfaceTypes, string | number | Uint8Array];
    return type === 'SkipEncode' ? value as Uint8Array: registry.createType(type, value).toU8a(NUM_TYPES.includes(type));
  });
  return u8aConcat(...encodedDataToSign);
}

function encodeRoyalties(royalties: Royalty[]): Uint8Array {
  const encodedRoyalties = royalties.map(r => {
    const orderedData = [{ H160: r.recipient_t1_address }, { u32: r.rate.parts_per_million }];
    return encodeOrderedData(orderedData);
  });

  const encodedResult = registry.createType('Vec<(H160, u32)>' as keyof InterfaceTypes, encodedRoyalties);
  return encodedResult.toU8a(false);
}

async function callWithTimeout<T>(timeRemaining: number, fn: (...args: any[]) => Promise<T>, args: any[]): Promise<T> {
  let timeout: NodeJS.Timeout;
  try {
    return await Promise.race([
      fn(...args),
      new Promise<T>((_, reject) => (timeout = setTimeout(() => reject(new Error('Timed out')), timeRemaining - EXECUTION_MARGIN)))
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

// Keep alphabetical
export {
  axios,
  BN,
  encodeProxyProof,
  buildSuccessResponse,
  buildErrorResponse,
  callWithTimeout,
  WEBHOOK_EVENT_TYPES,
  getPayerVaultUsername,
  getProxyProof,
  getRelayerFee,
  hashString,
  STASH_REWARD_DESTINATION,
  convertToAddress,
  convertToPublicKey,
  buildErrorBody,
  init,
  isSplitFeeToken,
  isSplitFeeTransaction,
  isValidArray,
  isValidAccountId,
  isValidAmount,
  isValidCurrencyFormat,
  isValidEthereumAddress,
  isValidEthereumTransactionHash,
  isValidNftId,
  isValidNonce,
  isValidRequestId,
  isValidSignatureFormat,
  isValidString,
  isValidProxySignature,
  NONCE_INFO,
  publishEvent,
  requestFailed,
  signatureVerify,
  stringToHex,
  toBnString,
  toWholeAVT,
  buildValidResponseBody,
  verifyAwtTokenSignature,
  verifySignatureWithOrWithoutWrapping,
  encodeRoyalties
};
