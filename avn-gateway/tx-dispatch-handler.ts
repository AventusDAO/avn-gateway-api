import * as utils from '/opt/utils';
import * as fees from '/opt/paymentUtils';
import * as sqs from '/opt/sqsUtils';
import {Text, GenericEthereumLookupSource, Vec, u8,u64,u128, U256} from '@polkadot/types'
import { H256,AccountId,H160, BalanceOf,  } from "@polkadot/types/interfaces"
import { SQSEvent, Context, SQSBatchResponse, Handler } from 'aws-lambda';

export type SignDataItem = | { Text: string }
  | { AccountId: AccountId }
  | { SkipEncode: string[] }
  | { 'Vec<u8>': Vec<u8>; }
  | { 'Vec<LookupSource>': Vec<GenericEthereumLookupSource>[]; }
  | { H256: H256; }
  | { U256: U256 }
  | { u8: u8; }
  | { u64: u64 }
  | { u128: u128 }
  | { BalanceOf: BalanceOf }
  | { H160: H160 };

const AVN_CONNECTOR_ENDPOINT: string = process.env.AVN_CONNECTOR_ENDPOINT || '';
const SQS_TX_QUEUE_URL: string = process.env.SQS_TX_QUEUE_URL || '';

export interface ValidResponse {
  jsonrpc: '2.0';
  id: string;
  result: any;
  body?: any;
}


export interface RPCError {
  code: number;
  message: string;
}

export interface ValidError {
  jsonrpc: '2.0';
  id: string;
  error: RPCError & { data: any };
  body?: any;
}

enum StatusCode {
  OK = 200,
  MultiStatus = 207,
  InternalServerError = 500
}

export interface TxDispatchHandlerResponse {
  statusCode: StatusCode;
  body: string;
}

type TxDispatchHandler = Handler<SQSEvent, (SQSBatchResponse|TxDispatchHandlerResponse) | void>

export const handler: TxDispatchHandler = async (event: SQSEvent, context: Context): Promise<TxDispatchHandlerResponse | SQSBatchResponse> => {
  await utils.init();
  let processedMessagesCount = 0;

  if (!event.Records) {
    console.log(`No messages to process.`);
    return {
      statusCode: StatusCode.OK,
      body: `No messages to process`
    };
  }

  console.log(`Processing ${event.Records.length} message(s) from queue`);

  try {
    for (let record of event.Records) {
      const result = await utils.callWithTimeout(context.getRemainingTimeInMillis(), processRequest, [record.body]);
      if (utils.requestFailed(result) === true) {
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
    console.error(`Failed to process messages: `, err);
    return {
      batchItemFailures: sqs.getFailedMessagesForFifoQueue(event.Records, processedMessagesCount)
    };
  }
};

async function processRequest(request: string): Promise<ValidResponse | ValidError> {
  let call: Call;

  try {
    call = JSON.parse(request);
  } catch (err) {
    console.error(`Failed to parse message as JSON: `, err);
    return utils.buildErrorBody('parse', 'Failed to parse message as JSON', err.toString(), request, null);
  }

  const requestId = call.awsRequestId ?? '';
  if (!call.id) call.id = '';

  console.info('CALLID_TO_REQUESTID:', `${call.id} : ${requestId}`);

  return validateAndProcessCall(call, request, requestId);
}

function validateAndProcessCall(call: Call, request: string, requestId: string): Promise<ValidResponse | ValidError> {
  if (typeof call.method !== 'string') {
    console.error(`Invalid method type: Expected string, received ${typeof call.method}`);
    return utils.buildErrorBody('request', 'Method type must be string', call.method, request, call.id);
  }

  try {
    return callSwitch(call, request, requestId);
  } catch (err) {
    console.error(`Failed to process message from default queue: `, err);
    return utils.buildErrorBody('request', 'Failed to process message from default queue', err.toString(), request, call.id);
  }
}

async function callSwitch(call: Call, request: string, requestId: string): Promise<ValidResponse | ValidError> {
  console.info(`${requestId} - Processing call: ${call.method}, proxy nonce: ${(call.params || {}).nonce}`);


  if (callConfigs[call.method]) {
    return await processProxyCall(call.method, call, request, requestId);
  } else {
    return utils.buildErrorBody('method', 'Method not found', call.method, request, call.id);
  }
}

async function processProxyCall(callType: string, call: Call, request: string, requestId: string): Promise<ValidResponse | ValidError> {
  const config = callConfigs[callType];
  if (!config) {
    throw new Error(`No configuration found for call type ${callType}`);
  }

  const { pallet, method, buildMethodParams, buildSignData } = config;
  let nonce = call.params.nonce ?? await queryNonce(requestId, utils.NONCE_INFO[config.nonceType], call.params.user);
  call.params.nonce = nonce;

  const methodParams = buildMethodParams(call.params);
  const signData = buildSignData({ ...call.params, nonce });

  try {
    validateSignData(signData, call.pallet);

    if (!utils.isValidProxySignature(call.params.proxySignature, call.params.user, signData)) {
      throw 'proxySignature';
    }
  } catch (param) {
    const badParamValue = JSON.stringify(call.params[param]);
    return utils.buildErrorBody('params', `invalid ${param}: ${badParamValue}`, param, request, call.id);
  }

  return await processProxyMethod(call, request, requestId, pallet, method, methodParams);
}

//TODO: Fix me. We should not read the nonce from the chain because we risk getting duplicate values for different tx's
async function queryNonce(requestId: string, nonceInfo: NonceInfo, nonceKey: string): Promise<string> {
  const { palletName, storageName } = nonceInfo;
  console.log(`${requestId} - Refreshing nonce from chain for ${palletName}.${storageName} - ${nonceKey}`);
  const params: QueryParams = { requestId, palletName, storageName, params: [nonceKey] };
  const result = await utils.axios.post(`${AVN_CONNECTOR_ENDPOINT}avnQuery`, params);
  const nonce = storageName === 'nfts' ? utils.toBnString(result.data.nonce) : utils.toBnString(result.data);
  console.log(`${requestId} - new nonce: ${nonce}`);
  return nonce;
}

async function processProxyMethod(
  call: Call,
  request: string,
  requestId: string,
  pallet: string,
  method: string,
  methodParams: any[]
): Promise<ValidResponse | ValidError> {
  const { relayer, user, payer, proxySignature } = call.params;

  try {
    if (!utils.isValidAccountId(relayer)) throw 'relayer';
    if (!utils.isValidAccountId(user)) throw 'user';
    if (!utils.isValidAccountId(payer)) throw 'payer';
    if (!utils.isValidSignatureFormat(proxySignature)) throw 'proxySignature';

    if (!utils.isSplitFeeTransaction(call)) {
      if (!utils.isValidSignatureFormat(call.params.feePaymentSignature!)) throw 'feePaymentSignature';
      if (!utils.isValidNonce(call.params.paymentNonce!)) throw 'paymentNonce';
    }
  } catch (param) {
    return utils.buildErrorBody('params', `invalid proxy method ${param}: ${call.params[param]}`, param, request, call.id);
  }

  const proxyProof: ProxyProof = utils.getProxyProof(user, relayer, proxySignature);

  const params: ProxyParams = {
    proxyParams: [proxyProof].concat(methodParams),
    relayerAddress: relayer
  };

  if (utils.isSplitFeeTransaction(call)) {
    params.splitFeePayerAddress = call.splitFeePayerAddress!;
    params.splitFeePayerVaultId = call.splitFeePayerVaultId!;
    params.relayerFees = call.relayerFee!;
    params.splitFeeProxyProof = proxyProof;
    const eventType = utils.WEBHOOK_EVENT_TYPES.tx_ready;
    await utils.publishEvent(AVN_CONNECTOR_ENDPOINT, eventType, requestId, params.splitFeePayerAddress, {
      relayer,
      user,
      proxySignature,
      pallet,
      method,
      methodParams
    } as PublishEventData);
  } else {
    const paymentInfo = await fees.tryGetPaymentInfo(
      AVN_CONNECTOR_ENDPOINT,
      payer,
      relayer,
      call.params.feePaymentSignature!,
      call.method,
      call.params.paymentNonce!,
      proxyProof
    );

    params.paymentInfo = paymentInfo;
  }

  return await sendTx(call, request, requestId, pallet, method, params);
}

async function sendTx(
  call: Call,
  request: string,
  requestId: string,
  palletName: string,
  method: string,
  params: ProxyParams
): Promise<ValidResponse | ValidError> {
  try {
    const txType = 'avnProxy';
    const tx: Transaction = { requestId, txType, palletName, method, params };
    const result = await sqs.sendToQueue(SQS_TX_QUEUE_URL, tx);
    return utils.buildValidResponseBody(call.id, result);
  } catch (err) {
    return utils.buildErrorBody('internal', 'failed to send proxy transaction', err.toString(), request, call.id);
  }
}

export interface CallParams {
  relayer: string;
  user: string;
  payer: string;
  proxySignature: string;
  nonce?: string;
  feePaymentSignature?: string;
  paymentNonce?: string;
}

export interface Call {
  id: string;
  params: CallParams;
  method: string;
  splitFeePayerAddress?: string;
  splitFeePayerVaultId?: string;
  relayerFee?: string;
  awsRequestId?: string;
}

export interface NonceInfo {
  palletName: string;
  storageName: string;
}

export interface Transaction {
  requestId: string;
  txType: string;
  palletName: string;
  method: string;
  params: ProxyParams
}


export interface ProxyParams {
  proxyParams: any[];
  relayerAddress: string;
  splitFeePayerAddress?: string;
  splitFeePayerVaultId?: string;
  relayerFees?: string;
  splitFeeProxyProof?: any;
  paymentInfo?: PaymentInfo;
}

export interface PaymentInfo {
  payer: string;
  recipient: string;
  amount: string;
  signature: {
    Sr25519: string;
  };
}

export interface ProxyProof {
  signer: string;
  relayer: string;
  signature: {
    Sr25519: string;
  };
}

export interface QueryParams {
  requestId: string;
  palletName: string;
  storageName: string;
  params: string[];
}

export interface PublishEventData {
  relayer: string;
  user: string;
  proxySignature: string;
  pallet: string;
  method: string;
  methodParams: any[];
}


const typeValidationMap = {
  AccountId: utils.isValidAccountId,
  H160: utils.isValidEthereumAddress,
  u128: utils.isValidAmount,
  H256: utils.isValidEthereumTransactionHash,
  u8: (value, pallet) => {
    if (pallet === 'nftManager') {
      return utils.isValidMarket(value);
    } else if (pallet === 'ethereumEvents') {
      return utils.isValidEventType(value);
    }
  },
  u64: utils.isValidNumber,
  SkipEncode: utils.isValidArray,
  U256: utils.isValidNftId,
  'Vec<u8>': utils.isValidString,
  'Vec<LookupSource>': utils.isValidArray
};

export interface CallConfig {
  pallet: string;
  method: string;
  nonceType?: string;
  buildMethodParams: (params: any) => any[];
  buildSignData: (params: any) => SignDataItem[];
}

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
      { Text: 'authorization for add ethereum log operation'  },
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
      { Text: 'authorization for add ethereum log operation'  },
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
      { Text: 'authorization for add ethereum log operation'  },
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
      { Text: 'authorization for add ethereum log operation'  },
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
      { Text: 'authorization for add ethereum log operation'  },
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
      { SkipEncode: utils.encodeRoyalties(royalties) },
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
      { Text: 'authorization for list nft open for sale operation' },
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
      { Text: 'authorization for list nft open for sale operation' },
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
      { SkipEncode: utils.encodeRoyalties(royalties) },
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
      { AccountId: utils.convertToPublicKey(relayer) },
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
      { Text: 'parachain authorization for nominator bond extra operation' },
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
      { Text: 'parachain authorization for scheduling leaving nominators operation' },
      { AccountId: relayer },
      { AccountId: user },
      { u64: nonce }
    ]
  },
};

function validateSignData(signData: SignDataItem[], pallet?: string): void {
  signData.forEach(item => {
    for (const [type, value] of Object.entries(item)) {
      const validator = typeValidationMap[type];
      if (!validator) {
        throw `${value}`;
      }

      if (type === 'u8') {
        if (!validator(value, pallet)) {
          throw `${value}`;
        }
      } else {
        if (!validator(value)) {
          throw `${value}`;
        }
      }
    }
  });
}