import * as utils from '/opt/utils';
import * as fees from '/opt/paymentUtils';
import * as sqs from '/opt/sqsUtils';
import { SQSEvent, Context } from 'aws-lambda';

const AVN_CONNECTOR_ENDPOINT: string = process.env.AVN_CONNECTOR_ENDPOINT || '';
const SQS_TX_QUEUE_URL: string = process.env.SQS_TX_QUEUE_URL || '';

export const handler = async (event: SQSEvent, context: Context): Promise<ValidResponse | ErrorResponse> => {
  await utils.init();
  let processedMessagesCount = 0;

  if (!event.Records) {
    console.log(`No messages to process.`);
    return {
      statusCode: 200,
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
        statusCode: 207,
        body: JSON.stringify(sqs.getFailedMessagesForFifoQueue(event.Records, processedMessagesCount))
      };
    }

    return {
      statusCode: 200,
      body: `${event.Records.length} message(s) processed successfully.`
    };
  } catch (err) {
    console.error(`Failed to process messages: `, err);
    return {
      statusCode: 500,
      body: `Failed to process messages due to an internal error.`
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

  const requestId = call.awsRequestId;
  if (!call.id) call.id = null;

  console.info('CALLID_TO_REQUESTID:', `${call.id} : ${requestId}`);

  return validateAndProcessCall(call, request, requestId);
}

function validateAndProcessCall(call: Call, request: string, requestId: string | undefined): Promise<ValidResponse | ValidError> {
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

interface CallHandlerMap {
  [method: string]: (call: Call, request: string, requestId: string) => Promise<ValidResponse | ValidError>;
}

const callHandlers: CallHandlerMap = {
  'proxyAvtTransfer': processProxyTransfer,
  'proxyTokenTransfer': processProxyTransfer,
  'proxyConfirmTokenLift': processProxyAddEthereumLog,
  'proxyMintEthereumBatchNft': processProxyAddEthereumLog,
  'proxyTransferEthereumNft': processProxyAddEthereumLog,
  'proxyCancelEthereumNftSale': processProxyAddEthereumLog,
  'proxyEndEthereumBatchSale': processProxyAddEthereumLog,
  'proxyTokenLower': processProxyTokenLower,
  'proxyCreateNftBatch': processProxyCreateNftBatch,
  'proxyCancelListFiatNft': processProxyCancelListFiatNft,
  'proxyEndNftBatchSale': processProxyEndNftBatchSale,
  'proxyListNftOpenForSale': processProxyListNftOpenForSale,
  'proxyListEthereumNftForSale': processProxyListNftOpenForSale,
  'proxyListNftBatchForSale': processProxyListNftBatchForSale,
  'proxyListEthereumNftBatchForSale': processProxyListNftBatchForSale,
  'proxyMintSingleNft': processProxyMintSingleNft,
  'proxyMintBatchNft': processProxyMintBatchNft,
  'proxyTransferFiatNft': processProxyTransferFiatNft,
  'proxyStakeAvt': processProxyStakeAvt,
  'proxyIncreaseStake': processProxyIncreaseStake,
  'proxyUnstake': processProxyUnstake,
  'proxyWithdrawUnlocked': processProxyWithdrawUnlocked,
  'proxyScheduleLeaveNominators': processProxyScheduleLeaveNominators,
  'proxyExecuteLeaveNominators': processProxyExecuteLeaveNominators
};


async function callSwitch(call: Call, request: string, requestId: string): Promise<ValidResponse | ValidError> {
  console.info(`${requestId} - Processing call: ${call.method}, proxy nonce: ${(call.params || {}).nonce}`);

  const handler = callHandlers[call.method];
  if (handler) {
    return await handler(call, request, requestId);
  } else {
    return utils.buildErrorBody('method', 'Method not found', call.method, request, call.id);
  }
}


async function processProxyTransfer(call: TransferCall, request: string, requestId: string): Promise<ValidResponse | ValidError> {
  const pallet = 'tokenManager';
  const method = 'signedTransfer';
  let { user, recipient, token, amount, relayer, nonce, proxySignature } = call.params;
  const methodParams: [string, string, string, string] = [user, recipient, token, amount];

  nonce = nonce ?? await queryNonce(requestId, utils.NONCE_INFO.token, user);

  const signData: SignDataItem[] = [
    { Text: 'authorization for transfer operation' },
    { AccountId: relayer },
    { AccountId: user },
    { AccountId: recipient },
    { H160: token },
    { u128: amount },
    { u64: nonce }
  ];

  try {
    if (utils.isValidAccountId(user) === false) throw 'user';
    if (utils.isValidAccountId(recipient) === false) throw 'recipient';
    if (utils.isValidEthereumAddress(token) === false) throw 'token';
    if (utils.isValidAmount(amount) === false) throw 'amount';
    if (utils.isValidProxySignature(proxySignature, user, signData) === false) throw 'proxySignature';
  } catch (param) {
    return utils.buildErrorBody('params', `invalid ${param}: ${call.params[param]}`, param, request, call.id);
  }

  return await processProxyMethod(call, request, requestId, pallet, method, methodParams);
}


async function processProxyAddEthereumLog(call: AddEthereumLogCall, request: string, requestId: string): Promise<ValidResponse | ValidError> {
  const pallet = 'ethereumEvents';
  const method = 'signedAddEthereumLog';
  let { eventType, ethereumTransactionHash, relayer, nonce, proxySignature, user } = call.params;
  const methodParams: [string, string] = [eventType, ethereumTransactionHash];

  nonce = nonce ?? await queryNonce(requestId, utils.NONCE_INFO.confirmation, user);
  call.params.nonce = nonce;

  const signData: SignDataItem[] = [
    { Text: 'authorization for add ethereum log operation' },
    { AccountId: relayer },
    { u8: eventType.toString() },
    { H256: ethereumTransactionHash },
    { u64: nonce }
  ];

  try {
    if (!utils.isValidEventType(eventType)) throw 'eventType';
    if (!utils.isValidEthereumTransactionHash(ethereumTransactionHash)) throw 'ethereumTransactionHash';
    if (!utils.isValidProxySignature(proxySignature, user, signData)) throw 'proxySignature';
  } catch (param) {
    const badParamValue = JSON.stringify(call.params[param]);
    return utils.buildErrorBody('params', `invalid ${param}: ${badParamValue}`, param, request, call.id);
  }

  return await processProxyMethod(call, request, requestId, pallet, method, methodParams);
}


async function processProxyTokenLower(call: TokenLowerCall, request: string, requestId: string): Promise<ValidResponse | ValidError> {
  const pallet = 'tokenManager';
  const method = 'scheduleSignedLower';
  let { user, token, amount, t1Recipient, relayer, nonce, proxySignature } = call.params;
  const methodParams: [string, string, string, string] = [user, token, amount, t1Recipient];

  nonce = nonce ?? await queryNonce(requestId, utils.NONCE_INFO.token, user);
  call.params.nonce = nonce;

  const signData: SignDataItem[] = [
    { Text: 'authorization for lower operation' },
    { AccountId: relayer },
    { AccountId: user },
    { H160: token },
    { u128: amount },
    { H160: t1Recipient },
    { u64: nonce }
  ];

  try {
    if (!utils.isValidAccountId(user)) throw 'user';
    if (!utils.isValidEthereumAddress(token)) throw 'token';
    if (!utils.isValidAmount(amount)) throw 'amount';
    if (!utils.isValidEthereumAddress(t1Recipient)) throw 't1Recipient';
    if (!utils.isValidProxySignature(proxySignature, user, signData)) throw 'proxySignature';
  } catch (param) {
    const badParamValue = JSON.stringify(call.params[param]);
    return utils.buildErrorBody('params', `invalid ${param}: ${badParamValue}`, param, request, call.id);
  }

  return await processProxyMethod(call, request, requestId, pallet, method, methodParams);
}


async function processProxyCreateNftBatch(call: CreateNftBatchCall, request: string, requestId: string): Promise<ValidResponse | ValidError> {
  const pallet = 'nftManager';
  const method = 'signedCreateBatch';
  let { totalSupply, royalties, t1Authority, relayer, nonce, proxySignature, user } = call.params;
  const methodParams: [number, any[], string] = [totalSupply, royalties, t1Authority];

  nonce = nonce ?? await queryNonce(requestId, utils.NONCE_INFO.batch, user);
  call.params.nonce = nonce;

  const signData: SignDataItem[] = [
    { Text: 'authorization for create batch operation' },
    { AccountId: relayer },
    { u64: totalSupply.toString() },
    { SkipEncode: utils.encodeRoyalties(royalties) },
    { H160: t1Authority },
    { u64: nonce }
  ];

  try {
    if (!utils.isValidNumber(totalSupply)) throw 'totalSupply';
    if (!utils.isValidArray(royalties)) throw 'royalties';
    if (!utils.isValidEthereumAddress(t1Authority)) throw 't1Authority';
    if (!utils.isValidProxySignature(proxySignature, user, signData)) throw 'proxySignature';
  } catch (param) {
    const badParamValue = JSON.stringify(call.params[param]);
    return utils.buildErrorBody('params', `invalid ${param}: ${badParamValue}`, param, request, call.id);
  }

  return await processProxyMethod(call, request, requestId, pallet, method, methodParams);
}


async function processProxyCancelListFiatNft(call: CancelListFiatNftCall, request: string, requestId: string): Promise<ValidResponse | ValidError> {
  const pallet = 'nftManager';
  const method = 'signedCancelListFiatNft';
  let { nftId, relayer, nonce, proxySignature, user } = call.params;
  const methodParams: string[] = [nftId];

  nonce = nonce ?? await queryNonce(requestId, utils.NONCE_INFO.nft, nftId);
  call.params.nonce = nonce;

  const signData: SignDataItem[] = [
    { Text: 'authorization for cancel list fiat nft for sale operation' },
    { AccountId: relayer },
    { U256: nftId },
    { u64: nonce }
  ];

  try {
    if (!utils.isValidNftId(nftId)) throw 'nftId';
    if (!utils.isValidProxySignature(proxySignature, user, signData)) throw 'proxySignature';
  } catch (param) {
    const badParamValue = JSON.stringify(call.params[param]);
    return utils.buildErrorBody('params', `invalid ${param}: ${badParamValue}`, param, request, call.id);
  }

  return await processProxyMethod(call, request, requestId, pallet, method, methodParams);
}


async function processProxyEndNftBatchSale(call: EndNftBatchSaleCall, request: string, requestId: string): Promise<ValidResponse | ValidError> {
  const pallet = 'nftManager';
  const method = 'signedEndBatchSale';
  let { batchId, relayer, nonce, proxySignature, user } = call.params;
  const methodParams: string[] = [batchId];

  nonce = nonce ?? await queryNonce(requestId, utils.NONCE_INFO.batch, user);
  call.params.nonce = nonce;

  const signData: SignDataItem[] = [
    { Text: 'authorization for end batch sale operation' },
    { AccountId: relayer },
    { U256: batchId },
    { u64: nonce }
  ];

  try {
    if (!utils.isValidNftId(batchId)) throw 'batchId';
    if (!utils.isValidProxySignature(proxySignature, user, signData)) throw 'proxySignature';
  } catch (param) {
    const badParamValue = JSON.stringify(call.params[param]);
    return utils.buildErrorBody('params', `invalid ${param}: ${badParamValue}`, param, request, call.id);
  }

  return await processProxyMethod(call, request, requestId, pallet, method, methodParams);
}


async function processProxyListNftOpenForSale(call: ListNftOpenForSaleCall, request: string, requestId: string): Promise<ValidResponse | ValidError> {
  const pallet = 'nftManager';
  const method = 'signedListNftOpenForSale';
  let { nftId, market, relayer, nonce, proxySignature, user } = call.params;
  const methodParams: [string, number] = [nftId, market];

  nonce = nonce ?? await queryNonce(requestId, utils.NONCE_INFO.nft, nftId);
  call.params.nonce = nonce;

  const signData: SignDataItem[] = [
    { Text: 'authorization for list nft open for sale operation' },
    { AccountId: relayer },
    { U256: nftId },
    { u8: market.toString() },
    { u64: nonce }
  ];

  try {
    if (!utils.isValidNftId(nftId)) throw 'nftId';
    if (!utils.isValidMarket(market)) throw 'market';
    if (!utils.isValidProxySignature(proxySignature, user, signData)) throw 'proxySignature';
  } catch (param) {
    const badParamValue = JSON.stringify(call.params[param]);
    return utils.buildErrorBody('params', `invalid ${param}: ${badParamValue}`, param, request, call.id);
  }

  return await processProxyMethod(call, request, requestId, pallet, method, methodParams);
}


async function processProxyListNftBatchForSale(call: ListNftBatchForSaleCall, request: string, requestId: string): Promise<ValidResponse | ValidError> {
  const pallet = 'nftManager';
  const method = 'signedListBatchForSale';
  let { batchId, market, relayer, nonce, proxySignature, user } = call.params;
  const methodParams: [string, number] = [batchId, market];

  nonce = nonce ?? await queryNonce(requestId, utils.NONCE_INFO.batch, user);
  call.params.nonce = nonce;

  const signData: SignDataItem[] = [
    { Text: 'authorization for list batch for sale operation' },
    { AccountId: relayer },
    { U256: batchId },
    { u8: market.toString() },
    { u64: nonce }
  ];

  try {
    if (!utils.isValidNftId(batchId)) throw 'batchId';
    if (!utils.isValidMarket(market)) throw 'market';
    if (!utils.isValidProxySignature(proxySignature, user, signData)) throw 'proxySignature';
  } catch (param) {
    const badParamValue = JSON.stringify(call.params[param]);
    return utils.buildErrorBody('params', `invalid ${param}: ${badParamValue}`, param, request, call.id);
  }

  return await processProxyMethod(call, request, requestId, pallet, method, methodParams);
}


async function processProxyMintSingleNft(call: MintSingleNftCall, request: string, requestId: string): Promise<ValidResponse | ValidError> {
  const pallet = 'nftManager';
  const method = 'signedMintSingleNft';
  const { externalRef, royalties, t1Authority, relayer, proxySignature, user } = call.params;
  const methodParams: [string, any[], string] = [externalRef, royalties, t1Authority];

  const signData: SignDataItem[] = [
    { Text: 'authorization for mint single nft operation' },
    { AccountId: relayer },
    { 'Vec<u8>': externalRef },
    { SkipEncode: utils.encodeRoyalties(royalties) },
    { H160: t1Authority }
  ];

  try {
    if (!utils.isValidString(externalRef)) throw 'externalRef';
    if (!utils.isValidArray(royalties)) throw 'royalties';
    if (!utils.isValidEthereumAddress(t1Authority)) throw 't1Authority';
    if (!utils.isValidProxySignature(proxySignature, user, signData)) throw 'proxySignature';
  } catch (param) {
    const badParamValue = JSON.stringify(call.params[param]);
    return utils.buildErrorBody('params', `invalid ${param}: ${badParamValue}`, param, request, call.id);
  }

  return await processProxyMethod(call, request, requestId, pallet, method, methodParams);
}


async function processProxyMintBatchNft(call: MintBatchNftCall, request: string, requestId: string): Promise<ValidResponse | ValidError> {
  const pallet = 'nftManager';
  const method = 'signedMintBatchNft';
  const { batchId, index, owner, externalRef, relayer, proxySignature, user } = call.params;
  const methodParams: [string, number, string, string] = [batchId, index, owner, externalRef];

  const signData: SignDataItem[] = [
    { Text: 'authorization for mint batch nft operation' },
    { AccountId: relayer },
    { U256: batchId },
    { u64: index.toString() },
    { 'Vec<u8>': externalRef },
    { AccountId: owner }
  ];

  try {
    if (!utils.isValidNftId(batchId)) throw 'batchId';
    if (!utils.isValidNumber(index)) throw 'index';
    if (!utils.isValidAccountId(owner)) throw 'owner';
    if (!utils.isValidString(externalRef)) throw 'externalRef';
    if (!utils.isValidProxySignature(proxySignature, user, signData)) throw 'proxySignature';
  } catch (param) {
    const badParamValue = JSON.stringify(call.params[param]);
    return utils.buildErrorBody('params', `invalid ${param}: ${badParamValue}`, param, request, call.id);
  }

  return await processProxyMethod(call, request, requestId, pallet, method, methodParams);
}


async function processProxyTransferFiatNft(call: TransferFiatNftCall, request: string, requestId: string): Promise<ValidResponse | ValidError> {
  const pallet = 'nftManager';
  const method = 'signedTransferFiatNft';
  let { nftId, recipient, relayer, nonce, proxySignature, user } = call.params;
  const methodParams: [string, string] = [nftId, recipient];

  nonce = nonce ?? await queryNonce(requestId, utils.NONCE_INFO.nft, nftId);
  call.params.nonce = nonce;

  const signData: SignDataItem[] = [
    { Text: 'authorization for transfer fiat nft operation' },
    { AccountId: relayer },
    { U256: nftId },
    { AccountId: recipient },
    { u64: nonce }
  ];

  try {
    if (!utils.isValidNftId(nftId)) throw 'nftId';
    if (!utils.isValidAccountId(recipient)) throw 'recipient';
    if (!utils.isValidProxySignature(proxySignature, user, signData)) throw 'proxySignature';
  } catch (param) {
    const badParamValue = JSON.stringify(call.params[param]);
    return utils.buildErrorBody('params', `invalid ${param}: ${badParamValue}`, param, request, call.id);
  }

  return await processProxyMethod(call, request, requestId, pallet, method, methodParams);
}


async function processProxyStakeAvt(call: StakeAvtCall, request: string, requestId: string): Promise<ValidResponse | ValidError> {
  const pallet = 'parachainStaking';
  const method = 'signedNominate';
  let { targets, amount, relayer, nonce, proxySignature, user } = call.params;
  const methodParams: [string[], string] = [targets, amount];

  nonce = nonce ?? await queryNonce(requestId, utils.NONCE_INFO.staking, user);
  call.params.nonce = nonce;

  const signData: SignDataItem[] = [
    { Text: 'parachain authorization for nominate operation' },
    { AccountId: utils.convertToPublicKey(relayer) },
    { 'Vec<LookupSource>': targets },
    { BalanceOf: amount },
    { u64: nonce }
  ];

  try {
    if (!utils.isValidArray(targets) || targets.length === 0) throw 'targets';
    if (!utils.isValidAmount(amount)) throw 'amount';
    if (!utils.isValidProxySignature(proxySignature, user, signData)) throw 'proxySignature';
  } catch (param) {
    const badParamValue = JSON.stringify(call.params[param]);
    return utils.buildErrorBody('params', `invalid ${param}: ${badParamValue}`, param, request, call.id);
  }

  return await processProxyMethod(call, request, requestId, pallet, method, methodParams);
}


async function processProxyIncreaseStake(call: IncreaseStakeCall, request: string, requestId: string): Promise<ValidResponse | ValidError> {
  const pallet = 'parachainStaking';
  const method = 'signedBondExtra';
  let { amount, relayer, nonce, proxySignature, user } = call.params;
  const methodParams: string[] = [amount];

  nonce = nonce ?? await queryNonce(requestId, utils.NONCE_INFO.staking, user);
  call.params.nonce = nonce;

  const signData: SignDataItem[] = [
    { Text: 'parachain authorization for nominator bond extra operation' },
    { AccountId: relayer },
    { BalanceOf: amount },
    { u64: nonce }
  ];

  try {
    if (!utils.isValidAmount(amount)) throw 'amount';
    if (!utils.isValidProxySignature(proxySignature, user, signData)) throw 'proxySignature';
  } catch (param) {
    return utils.buildErrorBody('params', `invalid ${param}: ${call.params[param]}`, param, request, call.id);
  }

  return await processProxyMethod(call, request, requestId, pallet, method, methodParams);
}


async function processProxyUnstake(call: UnstakeCall, request: string, requestId: string): Promise<ValidResponse | ValidError> {
  const pallet = 'parachainStaking';
  const method = 'signedScheduleNominatorUnbond';
  let { amount, relayer, nonce, proxySignature, user } = call.params;
  const methodParams: string[] = [amount];

  nonce = nonce ?? await queryNonce(requestId, utils.NONCE_INFO.staking, user);
  call.params.nonce = nonce;

  const signData: SignDataItem[] = [
    { Text: 'parachain authorization for scheduling nominator unbond operation' },
    { AccountId: relayer },
    { BalanceOf: amount },
    { u64: nonce }
  ];

  try {
    if (!utils.isValidAmount(amount)) throw 'amount';
    if (!utils.isValidProxySignature(proxySignature, user, signData)) throw 'proxySignature';
  } catch (param) {
    return utils.buildErrorBody('params', `invalid ${param}: ${call.params[param]}`, param, request, call.id);
  }

  return await processProxyMethod(call, request, requestId, pallet, method, methodParams);
}

async function processProxyWithdrawUnlocked(call: Call, request: string, requestId: string): Promise<ValidResponse | ValidError> {
  const pallet = 'parachainStaking';
  const method = 'signedExecuteNominationRequest';
  let { relayer, nonce, proxySignature, user } = call.params;
  const methodParams: string[] = [user];

  if (!nonce) {
    nonce = await queryNonce(requestId, utils.NONCE_INFO.staking, user);
    call.params.nonce = nonce;
  }

  const signData: SignDataItem[] = [
    { Text: 'parachain authorization for executing nomination requests operation' },
    { AccountId: relayer },
    { AccountId: user },
    { u64: nonce }
  ];

  try {
    if (!utils.isValidAccountId(user)) throw 'user';
    if (!utils.isValidProxySignature(proxySignature, user, signData)) throw 'proxySignature';
  } catch (param) {
    return utils.buildErrorBody('params', `invalid ${param}: ${call.params[param]}`, param, request, call.id);
  }

  return await processProxyMethod(call, request, requestId, pallet, method, methodParams);
}

async function processProxyScheduleLeaveNominators(call: Call, request: string, requestId: string): Promise<ValidResponse | ValidError> {
  const pallet = 'parachainStaking';
  const method = 'signedScheduleLeaveNominators';
  let { relayer, nonce, proxySignature, user } = call.params;
  const methodParams: any[] = [];

  nonce = nonce ?? await queryNonce(requestId, utils.NONCE_INFO.staking, user);
  call.params.nonce = nonce;

  const signData: SignDataItem[] = [
    { Text: 'parachain authorization for scheduling leaving nominators operation' },
    { AccountId: relayer },
    { u64: nonce }
  ];

  try {
    if (!utils.isValidProxySignature(proxySignature, user, signData)) {
      throw 'proxySignature';
    }
  } catch (param) {
    return utils.buildErrorBody('params', `invalid ${param}: ${call.params[param]}`, param, request, call.id);
  }

  return await processProxyMethod(call, request, requestId, pallet, method, methodParams);
}

async function processProxyExecuteLeaveNominators(call: Call, request: string, requestId: string): Promise<ValidResponse | ValidError> {
  const pallet = 'parachainStaking';
  const method = 'signedExecuteLeaveNominators';
  let { relayer, nonce, proxySignature, user } = call.params;
  const methodParams: string[] = [user];

  nonce = nonce ?? await queryNonce(requestId, utils.NONCE_INFO.staking, user);
  call.params.nonce = nonce;

  const signData: SignDataItem[] = [
    { Text: 'parachain authorization for executing leave nominators operation' },
    { AccountId: relayer },
    { AccountId: user },
    { u64: nonce }
  ];

  try {
    if (!utils.isValidAccountId(user)) throw 'user';
    if (!utils.isValidProxySignature(proxySignature, user, signData)) throw 'proxySignature';
  } catch (param) {
    return utils.buildErrorBody('params', `invalid ${param}: ${call.params[param]}`, param, request, call.id);
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

export interface Call {
  id: string;
  params: CallParams;
  method: string;
  splitFeePayerAddress?: string;
  splitFeePayerVaultId?: string;
  relayerFee?: string;
}

export interface CallParams {
  relayer: string;
  user: string;
  payer: string;
  proxySignature: string;
  feePaymentSignature?: string;
  paymentNonce?: string;
}

export interface ProxyProof {
  signer: string;
  relayer: string;
  signature: {
    Sr25519: string;
  };
}

export type RPCErrorType = 'parse' | 'request' | 'method' | 'params' | 'internal';

export interface RPCError {
  code: number;
  message: string;
}

export interface ErrorBody {
  jsonrpc: '2.0';
  id: string;
  error: RPCError & { data: any };
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

export interface UnstakeCallParams extends CallParams {
  amount: string;
}

export interface UnstakeCall extends Call {
  params: UnstakeCallParams;
  method: string;
}

export interface StakeAvtCallParams extends CallParams {
  targets: string[];
  amount: string;
}

export interface StakeAvtCall extends Call {
  id: string;
  params: StakeAvtCallParams;
  method: string;
}

export interface IncreaseStakeCallParams extends CallParams {
  amount: string;
}

export interface IncreaseStakeCall extends Call {
  params: IncreaseStakeCallParams;
  method: string;
}

export interface TransferFiatNftCallParams extends CallParams {
  nftId: string;
  recipient: string;
}

export interface TransferFiatNftCall extends Call {
  params: TransferFiatNftCallParams;
  method: string;
}

export interface MintBatchNftCallParams extends CallParams {
  batchId: string;
  index: number;
  owner: string;
  externalRef: string;
}

export interface MintBatchNftCall extends Call {
  params: MintBatchNftCallParams;
  method: string;
}

export interface MintSingleNftCallParams extends CallParams {
  externalRef: string;
  royalties: any[];
  t1Authority: string;
}

export interface MintSingleNftCall extends Call {
  params: MintSingleNftCallParams;
  method: string;
}

export interface ListNftBatchForSaleCallParams extends CallParams {
  batchId: string;
  market: number;
}

export interface ListNftBatchForSaleCall extends Call {
  id: string;
  params: ListNftBatchForSaleCallParams;
  method: string;
}
export interface ListNftOpenForSaleCallParams extends CallParams {
  nftId: string;
  market: number;
}

export interface ListNftOpenForSaleCall extends Call {
  id: string;
  params: ListNftOpenForSaleCallParams;
  method: string;
}

export interface EndNftBatchSaleCallParams extends CallParams {
  batchId: string;
}

export interface EndNftBatchSaleCall extends Call {
  params: EndNftBatchSaleCallParams;
  method: string;
}

export interface CancelListFiatNftCallParams extends CallParams {
  nftId: string;
}

export interface CancelListFiatNftCall extends Call {
  params: CancelListFiatNftCallParams;
  method: string;
}

export interface CreateNftBatchCallParams extends CallParams {
  totalSupply: number;
  royalties: any[];
  t1Authority: string;
}

export interface CreateNftBatchCall extends Call {
  params: CreateNftBatchCallParams;
  method: string;
}

export interface TokenLowerCallParams extends CallParams {
  user: string;
  token: string;
  amount: string;
  t1Recipient: string;
}

export interface TokenLowerCall extends Call {
  id: string;
  params: TokenLowerCallParams;
}

export interface AddEthereumLogCallParams extends CallParams {
  eventType: string;
  ethereumTransactionHash: string;
}

export interface AddEthereumLogCall extends Call {
  id: string;
  params: AddEthereumLogCallParams;
}

export interface TransferCallParams extends CallParams {
  recipient: string; token: string; amount: string;
}

export interface TransferCall extends Call {
  id: string;
  params: TransferCallParams;
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

export type SignDataItem = | { Text: string }
  | { AccountId: string }
  | { SkipEncode: string }
  | { 'Vec<u8>': string; }
  | { 'Vec<LookupSource>': string[]; }
  | { H256: string; }
  | { U256: string }
  | { u8: string; }
  | { u64: string }
  | { u128: string }
  | { BalanceOf: string }
  | { H160: string };



export interface ErrorResponse {
  statusCode: number;
  body: string;
}

export interface ProcessMethodResult {
  statusCode: number;
  body: string;
}

export interface SignatureData {
  Text?: string;
  AccountId?: string;
  H160?: string;
  u128?: string;
  u64?: string;
  H256?: string;
  U256?: string;
  'Vec<u8>'?: string;
  BalanceOf?: string;
  SkipEncode?: string;
}

export interface TransferParams {
  user: string;
  recipient: string;
  token: string;
  amount: string;
  relayer: string;
  nonce?: string;
  proxySignature: string;
}

export interface ProxyCallParams {
  relayer: string;
  user: string;
  payer: string;
  proxySignature: string;
  feePaymentSignature?: string;
  paymentNonce?: string;
}