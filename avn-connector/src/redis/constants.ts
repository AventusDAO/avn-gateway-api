export const SLOT_PREFIX = '{gateway}:'
export const NONCE_NAMESPACE = 'n.'
export const PAYER_NONCE_NAMESPACE = 'pn.'
export const TOTAL_TOKEN_NAMESPACE = 't.'
export const COLLATORS_KEY = 'collators'
export const STAKING_STAT_KEY = 'stakingStats'
export const CHAIN_INFO_KEY = 'chainInfo'
export const LIFTS_FROM_TIER1_BLOCK_KEY = 'liftsFromBlock'
export const LOWER_BLOCK_INDEX_KEY = 'lowerBlockIndex'
export const LOWERS_FROM_AVN_BLOCK_KEY = 'lowersFromBlock'
export const CLAIMED_LOWERS_FROM_TIER1_BLOCK_KEY = 'claimedLowersFromBlock'
export const PUBLISHED_ROOTS_FROM_TIER1_BLOCK_KEY = 'publishedRootsFromBlock'
export const UNPUBLISHED_LOWERS_KEY = 'lowersUnpublished'
export const AWAITING_CLAIM_DATA_LOWERS_KEY = 'lowersAwaitingData'
export const UNCLAIMED_LOWERS_KEY = 'lowersUnclaimed'
export const LOWER_DATA_KEY = 'lowerData'
export const SUMMARIES_KEY = 'summaries'
export const LAST_LOWER_BLOCK_ID_FROM_AVN = `${SLOT_PREFIX}lwr_lastAvnBlock`
export const WEBHOOKS_SENT_TX_KEY = 'txSent'

export const LOWER_ID_PREFIX = `${SLOT_PREFIX}lwr_id_`
export const LOWER_SENDER_PREFIX = `${SLOT_PREFIX}lwr_sender_`
export const LOWER_RECIPIENT_PREFIX = `${SLOT_PREFIX}lwr_recipient_`
export const LAST_CLAIMED_ETH_LOWER_BLOCK_PREFIX = 'lwr_eth_last_claimed'

// Autolower
export const AUTOLOWER_RETRY_LIFETIME_NAMESPACE = 'al.'
export const AUTOLOWERS_KEY = 'autolowers'
export const AUTOLOWER_LOCK_KEY = 'autolowerLock'
export const NEXT_T1_BLOCK_FOR_AUTOLOWER_KEY = 'nextT1BlockForAutolower'
export const LATEST_LOWER_ID_FOR_AUTOLOWER_KEY = 'latestLowerIdForAutolower'
export const AUTOLOWER_MAX_LOCK_IN_SECONDS = 600 // 10 minutes
export const AUTOLOWER_RETRY_LIFETIME_SECONDS = 1209600 // 14 days

export const PENDING_TX_KEY = {
  ALL: `${SLOT_PREFIX}aTx`,
  CHECKING: `${SLOT_PREFIX}cTx`,
  NEXT: `${SLOT_PREFIX}nTx`
}

export const MAX_PENDING_TX_TO_CHECK = 250
export const PENDING_TX_CHECKING_WINDOW_IN_SECONDS = 5
export const NONCE_EXPIRY_IN_SECONDS = 120
export const TOTAL_TOKEN_EXPIRY_IN_SECONDS = 300 // 5 minutes
export const COLLATORS_EXPIRY_IN_SECONDS = 86400 // 1 day
export const STAKING_STAT_EXPIRY_IN_SECONDS = 86400 // 1 day
export const CHAIN_INFO_EXPIRY_IN_SECONDS = 86400 // 1 day

export const transactionStatus = {
  Pending: 'Pending',
  Processed: 'Processed',
  Rejected: 'Rejected',
  SendingFailed: 'SendingFailed',
  PayerRefused: 'PayerRefused',
  AwaitingToSend: 'AwaitingToSend',
  Validating: 'Validating'
} as const
