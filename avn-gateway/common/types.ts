import { SendMessageCommandOutput } from "@aws-sdk/client-sqs";
import { InterfaceTypes } from "@polkadot/types/types";

import { GenericEthereumLookupSource, Vec, u8, u32, u64, u128, U256, u16, Compact, Option } from '@polkadot/types';
import { H256, H160, BalanceOf, Perbill } from "@polkadot/types/interfaces";

export enum EventType {
    AddedValidator = 0,
    Lifted = 1,
    NftMint = 2,
    NftTransferTo = 3,
    NftCancelListing = 4,
    NftEndBatchListing = 5
}

export enum MarketType {
    Ethereum = 1,
    Fiat = 2
}

export type PredictionMarketType = {
    Categorical: number;
};

export type PredictionMarketOutcomeType = {
    Categorical: number;
};

export type SignDataItem = | { Text: string }
    | { AccountId: string }
    | { SkipEncode: Uint8Array }
    | { 'Vec<u8>': Vec<u8>; }
    | { 'Vec<LookupSource>': Vec<GenericEthereumLookupSource>[]; }
    | { 'Vec<u128>': Vec<u128> }
    | { 'Vec<BalanceOf>': Vec<BalanceOf> }
    | { 'Compact<BalanceOf>': Compact<BalanceOf>}
    | { 'Strategy': string }
    | { H256: H256; }
    | { U256: U256 }
    | { u8: EventType | MarketType; }
    | { u16: u16 }
    | { u32: u32 }
    | { u64: u64 }
    | { u128: u128 }
    | { BalanceOf: BalanceOf }
    | { H160: H160 }
    | { AssetOf: string }
    | { Perbill: number }
    | { MarketPeriodOf: string }
    | { Deadlines: string }
    | { MultiHash: string }
    | { MarketType: PredictionMarketType }
    | { OutcomeReport: string }
    | { 'Option<MarketDisputeMechanism>': Option<any> }

export interface NonceInfo {
    batch: { palletName: string; storageName: string };
    confirmation: { palletName: string; storageName: string };
    nft: { palletName: string; storageName: string };
    payment: { palletName: string; storageName: string };
    staking: { palletName: string; storageName: string };
    token: { palletName: string; storageName: string };
    anchor: { palletName: string; storageName: string };
    prediction_Market: { palletName: string; storageName: string };
    prediction_User: { palletName: string; storageName: string };
    hybridRouter: { palletName: string; storageName: string };
    nodeManager: { palletName: string; storageName: string };
}

export type TransactionType = 'proxyAvtTransfer' |
    'proxyTokenTransfer' |
    'proxyConfirmTokenLift' |
    'proxyTokenLower' |
    'proxyCreateNftBatch' |
    'proxyMintSingleNft' |
    'proxyMintBatchNft' |
    'proxyListNftOpenForSale' |
    'proxyListNftBatchForSale' |
    'proxyTransferFiatNft' |
    'proxyCancelListFiatNft' |
    'proxyEndNftBatchSale' |
    'proxyIncreaseStake' |
    'proxyUnstake' |
    'proxyWithdrawUnlocked' |
    'proxyStakeAvt' |
    'proxyMintEthereumBatchNft' |
    'proxyTransferEthereumNft' |
    'proxyCancelEthereumNftSale' |
    'proxyEndEthereumBatchSale' |
    'proxyListEthereumNftForSale' |
    'proxyListEthereumNftBatchForSale'|
    'proxyRegisterHandler'|
    'proxySubmitCheckpoint'|
    'proxyCreateMarketAndDeployPool'|
    'proxyReport'|
    'proxyRedeemShares'|
    'proxyTransferAsset'|
    'proxySell'|
    'proxyBuy' |
    'proxyWithdrawAsset'

export interface RPCError {
    parse: { code: number; message: string };
    request: { code: number; message: string };
    method: { code: number; message: string };
    params: { code: number; message: string };
    internal: { code: number; message: string };
}

export interface CustomError {
    code: number;
    message: string;
    data?: ErrorData;
}

export interface ErrorData {
    gatewayError: string;
    request: any;
}

export interface ErrorBody {
    jsonrpc: string;
    id: string;
    error?: CustomError;
    data?:any
}

export interface Response {
    error?: {
        [key: string]: any;
    };
}

export type RPCResponse<T> = {
    jsonrpc: string;
    id: string;
    result: T;
};

export interface Token {
    payer?: string;
    hasPayer: boolean;
}

export interface Transaction {
    splitFeePayerAddress?: string;
}

export interface ErrorResponse {
    statusCode: number;
    error: {
        message: string;
    };
    body: any;
}

export interface SuccessResponse {
    statusCode: number;
    body: any;
}

export interface ProofParams { signer: string; relayer: string; signature: string }

export interface ProxyProof { signer: string; relayer: string; signature: { Sr25519?: string; Ecdsa?: string; } };

export interface PaymentInfo {
    payer: string;
    recipient: string;
    amount: string;
    token: string,
    signature: {
        Sr25519?: string;
        Ecdsa?: string;
    };
  }


export interface DataItem {
    [key: string]: string | number | Uint8Array;
}

export type ExtendedInterfaceTypes = keyof InterfaceTypes | 'SkipEncode';

export interface Royalty { recipient_t1_address: string; rate: { parts_per_million: number } }

export type SendTxResult = RPCResponse<SendMessageCommandOutput>