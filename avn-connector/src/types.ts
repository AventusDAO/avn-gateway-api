export type Era = {
    current: number,
    first: number,
    length: number
}

export type BatchInfo = {
    infoId: number,
    batchId: number,
    royalties: Royalty[],
    totalSupply: number,
    t1Authority: string,
    creator: string
}

export type InfoId = number;

export interface NftInfo {
    royalties: Royalty[];
    t1Authority: string;
}

export interface Nft {
    owner: string;
    nonce: number;
    infoId: number;
    uniqueExternalRef: string;
}

export interface CandidateInfo {
    bond: string;
    request?: {
        whenExecutable: string;
        amount: string
    }
}

export interface CandidateInfoResponse {
    isEmpty: boolean;
    toJSON: () => CandidateInfo;
}

export interface NominatorState {
    total: string
}

export interface NominatorRequest {
    whenExecutable: string;
    action: RequestAction;
}

interface RequestAction {
    isDecrease: boolean;
    isRevoke: boolean;
    toJSON: () => { decrease?: string; revoke?: string };
}

export interface liftStatus {
    isFalse: boolean
}

export interface transactionStatus {
    Pending: string
    Processed: string
    Rejected: string
    SendingFailed: string
    PayerRefused: string
    AwaitingToSend: string
    Validating: string
}

export interface transaction {
    signature: string
    transactionHash: string
}

export type uncheckedEvent = [transaction, number, number];


export interface event {
    event: {
        eventId: {
          signature: string
          transactionHash: string
        }
        eventData: {
          LogLifted: {
            tokenContract: string
            senderAddress: string
            receiverAddress: string
            amount: number
            nonce: number
          }
        }
      }
}

export interface accountInfo {
    nonce: number
    consumers: number
    providers: number
    sufficients: number
    data: {
      free: number
      reserved: number
      frozen: number
      flags: number
    }
}

export interface lowerReadyToClaim {
    params: string
    encodedLowerData: string
}

export type eventPendingChallenge = [event, string, string, number, number, number];

// export interface CandidateInfo {
//     isEmpty: boolean;
//     toJSON: () => { bond: string; request?: { whenExecutable: string; amount: string } };
// }

export interface Royalty { recipient_t1_address: string; rate: { parts_per_million: number } }

// export interface Era {
//     isEmpty: boolean;
//     toJSON: () => {
//         current: number,
//         first: number,
//         length: number
//     };
//   }