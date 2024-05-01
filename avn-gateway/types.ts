import { SQSEvent, Handler, SQSBatchResponse, APIGatewayProxyResult } from 'aws-lambda';
import { GenericEthereumLookupSource, Vec, u8, u64, u128, U256 } from '@polkadot/types'
import { H256, AccountId, H160, BalanceOf } from "@polkadot/types/interfaces"

export type CustomSQSHandler = Handler<SQSEvent, (SQSBatchResponse | APIGatewayProxyResult) | void>
export type TransactionStatus = 'Validating' | 'Processed' | 'Rejected';
export type TxEventsMap = Record<string, TransactionEvent>;
export type CrossChainTxMap = Map<string, CrossChainTxStatus | string>;
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

export enum LowerStatus {
    Success = 'success',
    Error = 'error'
}

export enum StatusCode {
    OK = 200,
    MultiStatus = 207,
    InternalServerError = 500
}

export interface CallConfig {
    pallet: string;
    method: string;
    nonceType?: string;
    buildMethodParams: (params: any) => any[];
    buildSignData: (params: any) => SignDataItem[];
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

export interface NonceInfo {
    palletName: string;
    storageName: string;
}

export interface TransactionEvent {
    name: string;
    args: any;
    extrinsic: {
        hash: string;
        indexInBlock: number;
        success: boolean;
        block: {
            height: number;
        };
    };
}

export interface BlockchainEvent {
    name: string;
    args: any;
}

export interface TransactionResponse {
    transactionHash: string;
    status: string;
    blockNumber: number;
    index: number;
    eventArgs: any;
}

export interface CrossChainTxStatus {
    status: TransactionStatus;
    ethEventId?: string;
    signature: string;
    transactionHash: string;
}

export interface ErrorResponse {
    error: string
}

export interface LowerResult {
    statusCode: StatusCode,
    headers: {
        [name: string]: string
    },
    body: string,
}

export interface Lower {
    lowerData: [],
    status: LowerStatus,
}

export interface QueryStringParam {
    account?: string
}

export interface ValidResponse {
    jsonrpc: '2.0';
    id: string;
    result: string;
}

export interface RPCError {
    code: number;
    message: string;
}

export interface ValidError {
    jsonrpc: '2.0';
    id: string;
    error: RPCError & {
        data: {
            gatewayError: string,
            request: string,
        }
    };
}

export interface UserInfo {
    freeBalance: string;
    paymentNonce: string;
}

export interface PayerData {
    payerId: string;
    payerAddress: string;
    vaultId: string;
}

export interface AWTToken {
    pk: string;
    iat: string;
    sig: string;
    hasPayer: boolean;
    payer?: string;
}

export interface ValidRequestContext {
    isSplitFeeUser?: boolean;
    splitFeePayerId?: string;
    splitFeePayerVaultId?: string;
    splitFeePayerAddress?: string;
}

export interface LiftTransaction {
    txType: string;
    requestId: string;
    toBlock: number;
    unprocessedLifts: string[];
}

export interface EventRecord {
    messageId: string,
    body: string,
}

export interface Event {
    id: string,
    freshness: string,
    signature: string,
    endpoint: string,
    data: string
}

export interface Call {
    id: string | null,
    method: string,
    params?: {
        requestId?: string;
        accountId?: string;
        nonceType?: string;
        externalRef?: string;
        nftId?: string;
        batchId?: string;
        relayer?: string;
        user?: string;
        transactionType?: string;
        token?: string;
        fromTimestamp?: string;
        toTimestamp?: string;
    };
}

export interface ProxyCall {
    id: string,
    awsRequestId?: string,
    splitFeePayerId?: string,
    splitFeePayerVaultId?: string,
    splitFeePayerAddress?: string,
    method?: string,
    relayerFee?: number,
    params?: ProxyCallParams,
    pallet?: string,
}

export interface ProxyCallParams {
    user?: string,
    relayer?: string,
    payer?: string,
    proxySignature?: string
    feePaymentSignature?: string;
    paymentNonce?: string;
    nonce?: string;
}

export interface ProxyTransaction {
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
    relayerFees?: number;
    splitFeeProxyProof?: any;
    paymentInfo?: PaymentInfo;
}

export interface Transaction {
    id: string,
    awsRequestId?: string,
    splitFeePayerId?: string,
    splitFeePayerVaultId?: string,
    splitFeePayerAddress?: string,
    method?: string,
    relayerFee?: number,
    params?: TransactionParams,
    pallet?: string,
}

export interface TransactionParams {
    user?: string,
    relayer?: string,
    payer?: string,
    proxySignature?: string
    feePaymentSignature?: string;
    paymentNonce?: string;
    nonce?: string;
}

export interface LiftData {
    fromBlock: number;
    toBlock: number;
    unprocessedLifts: string[];
}

export interface VoterIntention {
    proposal: string;
    vote: boolean;
    publicKey: string;
    address: string;
    signature: string;
}

export interface ProposalData {
    votes?: Record<string, number>;
    scores: number[];
    votingChoice: number[];
    title: string;
    description: string;
    start: number;
    end: number;
    blockNumber: number;
}

export interface FormattedVote {
    address: string;
    voteSway: number;
    avtWeight: number;
}

export interface FormattedProposal {
    title: string;
    description: string;
    start: number;
    end: number;
    proposal: string;
    status: string;
    blockNumber: number;
    numVotes: number;
    scores: number[];
    votingChoice: number[];
    votes?: FormattedVote[];
}
