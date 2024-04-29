import { InterfaceTypes } from "@polkadot/types/types";

export interface NonceInfo {
    batch: { palletName: string; storageName: string };
    confirmation: { palletName: string; storageName: string };
    nft: { palletName: string; storageName: string };
    payment: { palletName: string; storageName: string };
    staking: { palletName: string; storageName: string };
    token: { palletName: string; storageName: string };
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
    'proxyListEthereumNftBatchForSale'

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
    payer?: string[];
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

export interface ProxyProof { signer: string; relayer: string; signature: { Sr25519: string; } };

export interface PaymentInfo {
    payer: string;
    recipient: string;
    amount: string;
    signature: {
      Sr25519: string;
    };
  }
  

export interface DataItem {
    [key: string]: string | number | Uint8Array;
}

export type ExtendedInterfaceTypes = keyof InterfaceTypes | 'SkipEncode';

export interface Royalty { recipient_t1_address: string; rate: { parts_per_million: number } }