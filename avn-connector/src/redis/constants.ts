enum Prefix {
  AutolowerRetry = 'AUTOLOWER_RETRY_',
  LowerId = 'LOWER_ID_',
  LowerRecipient = 'LOWER_RECIPIENT_',
  LowerSender = 'LOWER_SENDER_',
  Nonce = 'NONCE_',
  Payer = 'PAYER_',
  Token = 'TOKEN_',
  TxId = 'TX_ID_',
}

enum Key {
  Autolower = 'AUTOLOWER',
  AutolowerEthBlock = 'AUTOLOWER_ETH_BLOCK',
  AutolowerId = 'AUTOLOWER_ID',
  AutolowerLock = 'AUTOLOWER_LOCK',
  ChainInfo = 'CHAIN_INFO',
  Collators = 'COLLATORS',
  LiftingEthBlock = 'LIFTING_ETH_BLOCK',
  LoweringAvnBlock = 'LOWERING_AVN_BLOCK',
  LoweringEthBlock = 'LOWERING_ETH_BLOCK',
  PendingTxAll = 'PENDING_TX_ALL',
  PendingTxCheck = 'PENDING_TX_CHECK',
  PendingTxNext = 'PENDING_TX_NEXT',
  StakingStats = 'STAKING_STATS',
  Webhooks = 'WEBHOOKS'
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
  AwaitingToSend = 'AWAITING_TO_SEND',
  PayerRefused = 'PAYER_REFUSED',
  Pending = 'PENDING',
  Processed = 'PROCESSED',
  Rejected = 'REJECTED',
  SendingFailed = 'SENDING_FAILED',
  Validating = 'VALIDATING'
}

enum Limit {
  PendingTxCheck = 250
}

export {
  Prefix,
  Key,
  Expiry,
  TransactionStatus,
  Limit
}