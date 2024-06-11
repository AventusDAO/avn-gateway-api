export const SLOT_PREFIX = '{gateway}:';

enum Prefix {
  AutolowerRetry = 'AUTOLOWER_RETRY_',
  LowerId = 'LOWER_ID_',
  LowerRecipient = 'LOWER_RECIPIENT_',
  LowerSender = 'LOWER_SENDER_',
  Nonce = 'NONCE_',
  Payer = 'PAYER_',
  Token = 'TOKEN_',
  TxId = 'TX_ID_'
}

enum Key {
  Autolower = `${SLOT_PREFIX}AUTOLOWER`,
  AutolowerEthBlock = `${SLOT_PREFIX}AUTOLOWER_ETH_BLOCK`,
  AutolowerId = `${SLOT_PREFIX}AUTOLOWER_ID`,
  AutolowerLock = `${SLOT_PREFIX}AUTOLOWER_LOCK`,
  ChainInfo = `${SLOT_PREFIX}CHAIN_INFO`,
  Collators = `${SLOT_PREFIX}COLLATORS`,
  LiftingEthBlock = `${SLOT_PREFIX}LIFTING_ETH_BLOCK`,
  LoweringAvnBlock = `${SLOT_PREFIX}LOWERING_AVN_BLOCK`,
  LoweringEthBlock = `${SLOT_PREFIX}LOWERING_ETH_BLOCK`,
  PendingTxAll = `${SLOT_PREFIX}PENDING_TX_ALL`,
  PendingTxCheck = `${SLOT_PREFIX}PENDING_TX_CHECK`,
  PendingTxNext = `${SLOT_PREFIX}PENDING_TX_NEXT`,
  StakingStats = `${SLOT_PREFIX}STAKING_STATS`,
  Webhooks = `${SLOT_PREFIX}WEBHOOKS`
}

// Expiry times are in seconds
enum Expiry {
  AutolowerLock = 600,
  AutolowerRetryLifetime = 1209600,
  ChainInfo = 86400,
  Collators = 86400,
  Nonce = 120,
  PendingTxCheck = 5,
  StakingStats = 86400,
  Token = 300
}

enum TransactionStatus {
  AwaitingToSend = 'AwaitingToSend',
  PayerRefused = 'PayerRefused',
  Pending = 'Pending',
  Processed = 'Processed',
  Rejected = 'Rejected',
  SendingFailed = 'SendingFailed',
  Validating = 'Validating'
}

enum Limit {
  PendingTxCheck = 250
}

export { Prefix, Key, Expiry, TransactionStatus, Limit };
