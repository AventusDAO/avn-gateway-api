export type Era = {
  current: number;
  first: number;
  length: number;
};

export interface BatchInfo {
  ownerAddress?: string;
  infoId?: string;
  royalties?: Royalty[];
  totalSupply?: number;
  marketplaceId?: string;
  batchId?: string;
  t1Authority?: string;
  creator?: string;
}

export interface NftInfo {
  ownerAddress?: string;
  nonce?: number;
  infoId?: number;
  uniqueExternalRef?: string;
  royalties?: Royalty[];
  marketplaceId?: string;
  t1Authority?: string;
}

export interface Royalty {
  recipient_t1_address: string;
  rate: {
    parts_per_million: number;
  };
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
    amount: string;
  };
}

export interface NominatorState {
  total: string;
}

export interface liftStatus {
  isFalse: boolean;
}

export interface transactionStatus {
  Pending: string;
  Processed: string;
  Rejected: string;
  SendingFailed: string;
  PayerRefused: string;
  AwaitingToSend: string;
  Validating: string;
}

export interface accountInfo {
  nonce: number;
  consumers: number;
  providers: number;
  sufficients: number;
  data: {
    free: number;
    reserved: number;
    frozen: number;
    flags: number;
  };
}

export interface lowerReadyToClaim {
  params: string;
  encodedLowerData: string;
}

export interface PollResult {
  txHash: string | null;
  status: string;
  blockNumber: string;
  transactionIndex: string;
  senderNonce: string;
  eventArgs: any;
}

export interface TxNotFoundResult {
  status: string;
}

export interface PollErrorResult {
  error: string;
}

export interface AccountInfo {
  totalBalance: string;
  freeBalance: string;
  stakedBalance: string;
  unlockedBalance: string;
  unstakedBalance: string;
}

export type AccountInfoNonStaking = Pick<
  AccountInfo,
  'totalBalance' | 'freeBalance'
>;

export interface UnprocessedLifts {
  fromBlock: number;
  toBlock: number;
  unprocessedLifts: string[];
}

export interface EthereumEventStatus {
  transactionHash: string;
  liftStatus: string;
}

export interface LowerData {
  lowerId?: string;
  token?: string;
  to?: string;
  amount?: string;
  name?: string;
  from?: string;
  claimData?: any;
  [key: string]: string | undefined | any;
}

export interface GatewayUserInfo {
  paymentNonce: string;
  freeBalance: string;
}

export interface PayerInfo {
  payerId: number;
  payerAddress: string;
  vaultId: string;
}

export interface SuccessResponse<T> {
  data: T;
}

export interface TotalToken {
  total: string;
}

export interface BlockId {
  blockNumber: number;
  index: number;
}

export enum LiftStatuses {
  AWAITING_TO_RECEIVE = 'AwaitingToReceive',
  UNCHECKED_LIFT = 'UncheckedLift',
  PENDING_VALIDATION = 'PendingValidation',
  LIFT_PROCESSED = 'LiftProcessed',
  LIFT_REJECTED = 'LiftRejected',
  LIFT_NOT_FOUND = 'LiftNotFound'
}

export interface ChainSummary {
  rootId: {
    rootRange: {
      from_block: number;
    };
  };
  rootData: {
    rootHash: string;
    addedBy: string;
    isValidated: boolean;
    isFinalised: boolean;
    txId: number;
  };
}

export interface NodeManagerConfig {
  rewardAccount: string,
  nodeRegistrationTransactionLifetime: string,
  nodeRegistrar: string,
  heartbeatPeriodInBlocks: string,
  rewardAmount: string,
  rewardPeriodInBlocks: string,
  rewardEnabled: boolean,
}

export interface NodeManagerInfo {
  currentRewardPeriodIndex: number,
  oldestUnpaidRewardPeriodIndex: number,
  totalRegisteredNodes: number,
  totalLiveNodes: number,
}

export interface NodeManagerRewardPeriodInfo {
  current: string,
  first: string,
  length: string,
}