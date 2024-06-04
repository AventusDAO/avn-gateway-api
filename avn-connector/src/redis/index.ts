const config = require('multiconfig').load({ directory: '../config' })
import { Cluster, Redis } from 'ioredis'
import logger from '../logger'
import { Prefix, Key, Expiry, Limit, TransactionStatus } from './constants'
import { transactionObject } from './types'
import _ from 'lodash'

class RedisClient {
  client: Redis | Cluster

  async connect() {
    this.client = await this.initializeClient()
    await this.logConnection(this.client)
    this.defineCommands()
  }
  private async initializeClient(): Promise<Redis | Cluster> {
    if ('redis' in config) {
      logger.info(
        `Attempting to connect to Redis database on ${config.redis.url}:${config.redis.port}`
      )
      const client = new Cluster([
        { port: Number(config.redis.port), host: `${config.redis.url}` }
      ])
      return client
    } else {
      return new Redis()
    }
  }

  private async logConnection(client: Redis | Cluster) {
    logger.info(
      'Connected to Redis database:\n',
      (await client.hello())
        .map((e: any, i: number) => (i % 2 == 0 ? e + ':' : e + ', '))
        .join('')
    )
  }

  private defineCommands() {
    if (!this.client) {
      throw new Error('Redis client is not initialized')
    }
    this.client.defineCommand('addzrangebyscore', {
      numberOfKeys: 2,
      lua: `local subset = redis.call('ZRANGE', KEYS[1], ARGV[1], ARGV[2], 'BYSCORE', 'WITHSCORES')
            local subsetCopy = {unpack(subset)}
            if table.getn(subset) > 0 then
              for i=1,table.getn(subset)/2 do
                local pos1 = 2 * i
                local pos2 = pos1 - 1
                local swap = subset[pos1]
                subset[pos1] = subset[pos2]
                subset[pos2] = swap
              end
              table.insert(subset, 1, 'ZADD')
              table.insert(subset, 2, KEYS[2])
              redis.call(unpack(subset))
              return table.getn(subsetCopy)/2
            else
              return 0
            end`
    })

    this.client.defineCommand('nextzsubset', {
      numberOfKeys: 2,
      lua: `local subset = redis.call('ZRANGE', KEYS[1], 0, ARGV[1]-1)
            local subsetCopy = {unpack(subset)}
            if table.getn(subset) > 0 then
              for i=1,table.getn(subset)
                do table.insert(subset, i*2-1, ARGV[2])
              end
              table.insert(subset, 1, 'ZADD')
              table.insert(subset, 2, KEYS[2])
              redis.call(unpack(subset))
              return subsetCopy
            else
              return {}
            end`
    })
  }

  async setKey(key: string, value: string, expiry?: number): Promise<void> {
    if (expiry) {
      await this.client.setex(key, expiry, value)
    } else {
      await this.client.set(key, value)
    }
  }

  async getKey(key: string): Promise<string | null> {
    return await this.client.get(key)
  }

  async delKey(key: string): Promise<void> {
    await this.client.del(key)
  }

  async hsetKey(key: string, value: Record<string, any>): Promise<void> {
    await this.client.hset(key, value)
  }

  async hgetKey(key: string): Promise<Record<string, any>> {
    return await this.client.hgetall(key)
  }

  async saddKey(key: string, value: string): Promise<number> {
    return await this.client.sadd(key, value)
  }

  async sremKey(key: string, value: string): Promise<void> {
    await this.client.srem(key, value)
  }

  async smembersKey(key: string): Promise<string[]> {
    return await this.client.smembers(key)
  }

  async multiExec(commands: [string, any[]][]): Promise<any> {
    const multi = this.client.multi()
    commands.forEach(([command, args]) => {
      ;(multi as any)[command](...args)
    })
    return await multi.exec()
  }

  async addNewAvnTransaction(
    requestId: string,
    requestIdHash: string
  ): Promise<void> {
    const transactionHashKey = Prefix.TxId + requestIdHash
    const requestIdKey = Prefix.TxId + requestId

    logger.info(
      `[redis] [addNewAvnTransaction] - requestId: ${requestId}, transactionHash: ${requestIdHash}`
    )

    if (await this.client.exists(transactionHashKey)) {
      logger.error(
        `Transaction hash (${transactionHashKey}) exists already, cannot add duplicate value.`
      )
      return
    }

    await this.multiExec([
      [
        'hset',
        [
          transactionHashKey,
          this.buildTransactionJson(
            undefined,
            undefined,
            TransactionStatus.AwaitingToSend
          )
        ]
      ],
      ['set', [requestIdKey, requestIdHash]]
    ])
  }

  async addFailedAvnTransaction(
    requestId: string,
    txHashOrRequestId: string,
    senderAddress: string | undefined,
    senderNonce: string | undefined,
    reason: string
  ): Promise<void> {
    const txHashOrRequestIdKey = Prefix.TxId + txHashOrRequestId
    const requestIdKey = Prefix.TxId + requestId

    logger.info(
      `[redis] [addFailedAvnTransaction] - requestId: ${requestId}, transactionHash: ${txHashOrRequestId}, senderAddress: ${senderAddress}, senderNonce: ${senderNonce}, reason: ${reason}`
    )

    if (await this.client.exists(txHashOrRequestIdKey)) {
      logger.warn(
        `Updating status of transaction: ${txHashOrRequestId} (${requestId}) to ${reason}`
      )
      await this.hsetKey(
        txHashOrRequestIdKey,
        this.buildTransactionJson(senderAddress, senderNonce, reason)
      )
      return
    }

    await this.multiExec([
      [
        'hset',
        [
          txHashOrRequestIdKey,
          this.buildTransactionJson(senderAddress, senderNonce, reason)
        ]
      ],
      ['set', [requestIdKey, txHashOrRequestId]]
    ])
  }

  async updateTransactionStatusToPending(
    requestId: string,
    transactionHash: string,
    senderAddress: string,
    senderNonce: string
  ): Promise<void> {
    const transactionHashKey = `${Prefix.TxId}${transactionHash}`
    const requestIdKey = Prefix.TxId + requestId

    logger.info(
      `[redis] [updateTransactionStatusToPending] - requestId: ${requestId}, transactionHash: ${transactionHash}, senderAddress: ${senderAddress}, senderNonce: ${senderNonce}`
    )

    const age = Date.now()
    await this.multiExec([
      [
        'hset',
        [
          transactionHashKey,
          this.buildTransactionJson(
            senderAddress,
            senderNonce,
            TransactionStatus.Pending
          )
        ]
      ],
      ['zadd', [Key.PendingTxAll, age, transactionHash]],
      ['set', [requestIdKey, transactionHash]]
    ])
  }

  async getAvnTransaction(
    txHashOrRequestId: string | null
  ): Promise<Record<string, string> | undefined> {
    if (txHashOrRequestId === null) return undefined
    const txHashOrRequestIdKey = Prefix.TxId + txHashOrRequestId
    const result = await this.hgetKey(txHashOrRequestIdKey)
    return Object.keys(result).length === 0 ? undefined : result
  }

  async resolvePendingAvnTransactions(transactions: any[]): Promise<void> {
    if (!transactions) {
      logger.info(`[redis] No transactions to update`)
      return
    }

    logger.info(`[redis] Updating ${transactions.length} transactions`)
    for (const tx of transactions) {
      const transactionHashKey = Prefix.TxId + tx.transactionHash

      if (
        ![
          TransactionStatus.Processed,
          TransactionStatus.Rejected,
          TransactionStatus.Validating
        ].includes(tx.status)
      ) {
        logger.warn({
          message: 'invalid status, ignoring request',
          transactionHash: tx.transactionHash,
          txStatus: tx.status
        })
        continue
      }

      const newValue: Record<string, any> = {}
      newValue[transactionObject.status] = tx.status
      newValue[transactionObject.blockNumber] = tx.blockNumber
      newValue[transactionObject.transactionIndex] = tx.index
      newValue[transactionObject.eventArgs] = this.dataToJsonString(
        tx.eventArgs
      )

      if (tx.status === TransactionStatus.Validating) {
        logger.info(
          `[redis] Updating tx status to validated: txHash: ${tx.transactionHash}`
        )

        const pendingTx = await this.hgetKey(transactionHashKey)
        if (
          ![
            TransactionStatus.Processed,
            TransactionStatus.Rejected,
            TransactionStatus.Validating
          ].includes(pendingTx.status)
        ) {
          await this.hsetKey(transactionHashKey, newValue)
        }
      } else {
        await this.multiExec([
          ['hset', [transactionHashKey, newValue]],
          ['zrem', [Key.PendingTxAll, tx.transactionHash]],
          ['zrem', [Key.PendingTxCheck, tx.transactionHash]],
          ['zrem', [Key.PendingTxNext, tx.transactionHash]]
        ])
      }
    }
  }

  async getNextTransactionsToCheck(): Promise<string[]> {
    const timeNow = Date.now()
    const expiry = timeNow + Expiry.PendingTxCheck * 1000

    const [numUpdated, numExpired, numAwaitingCheck, txToCheckNext] =
      await this.multiExec([
        [
          'addzrangebyscore',
          [Key.PendingTxCheck, Key.PendingTxAll, '-inf', timeNow]
        ],
        ['zremrangebyscore', [Key.PendingTxCheck, '-inf', timeNow]],
        [
          'zdiffstore',
          [Key.PendingTxNext, 2, Key.PendingTxAll, Key.PendingTxCheck]
        ],
        [
          'nextzsubset',
          [
            Key.PendingTxNext,
            Key.PendingTxCheck,
            Limit.PendingTxCheck,
            expiry
          ]
        ]
      ])

    if (numUpdated[1] !== numExpired[1]) {
      logger.warn(
        `[redis] Count of expired (${numExpired[1]}) and updated (${numUpdated[1]}) transactions differs\n`
      )
    }
    logger.info(`[redis] Transactions with updated expiry: ${numUpdated[1]}\n`)
    logger.info(`[redis] Transactions awaiting check: ${numAwaitingCheck[1]}\n`)
    logger.info(`[redis] Next transactions to check: ${txToCheckNext[1]}\n`)
    return txToCheckNext[1]
  }

  async getTransactionHashByRequestId(
    requestId: string
  ): Promise<string | null> {
    const requestIdKey = Prefix.TxId + requestId
    return await this.getKey(requestIdKey)
  }

  private buildTransactionJson(
    senderAddress: string | undefined,
    senderNonce: string | undefined,
    status: string
  ): Record<string, string> {
    const result: Record<string, string> = {}
    result[transactionObject.senderAddress] = senderAddress || ''
    result[transactionObject.senderNonce] = senderNonce || ''
    result[transactionObject.status] = status
    return result
  }

  async getNextNonce(senderAddress: string): Promise<number | undefined> {
    const nonce = await this.getKey(Prefix.Nonce + senderAddress)
    return nonce == null ? undefined : Number(nonce)
  }

  async setNextNonce(senderAddress: string, nonce: number): Promise<void> {
    await this.setKey(
      Prefix.Nonce + senderAddress,
      nonce.toString(),
      Expiry.Nonce
    )
  }

  async getNextPayerNonce(payerAddress: string): Promise<number | undefined> {
    const nonce = await this.getKey(Prefix.Payer + payerAddress)
    return nonce == null ? undefined : Number(nonce)
  }

  async setNextPayerNonce(payerAddress: string, nonce: number): Promise<void> {
    await this.setKey(
      Prefix.Payer + payerAddress,
      nonce.toString(),
      Expiry.Nonce
    )
  }

  async setCollatorsToNominate(collators: any): Promise<void> {
    await this.setKey(
      Key.Collators,
      this.dataToJsonString(collators),
      Expiry.Collators
    )
  }

  async getCollatorsToNominate(): Promise<any | undefined> {
    const collators = await this.getKey(Key.Collators)
    return collators ? JSON.parse(collators) : undefined
  }

  async setStakingStats(stakingStats: any): Promise<void> {
    await this.setKey(
      Key.StakingStats,
      this.dataToJsonString(stakingStats),
      Expiry.StakingStats
    )
  }

  async getStakingStats(): Promise<any | undefined> {
    const stakingStats = await this.getKey(Key.StakingStats)
    return stakingStats ? JSON.parse(stakingStats) : undefined
  }

  async setChainInfo(chainInfo: any): Promise<void> {
    await this.setKey(
      Key.ChainInfo,
      this.dataToJsonString(chainInfo),
      Expiry.ChainInfo
    )
  }

  async getChainInfo(): Promise<any | undefined> {
    const chainInfo = await this.getKey(Key.ChainInfo)
    return chainInfo ? JSON.parse(chainInfo) : undefined
  }

  async setLiftsFromTier1Block(blockNumber: number): Promise<void> {
    await this.setKey(Key.LiftingEthBlock, blockNumber.toString())
  }

  async getLiftsFromTier1Block(): Promise<number> {
    const blockNumber = await this.getKey(Key.LiftingEthBlock)
    return blockNumber ? Number(blockNumber) : 0
  }

  async setTotalToken(token: string, total: string): Promise<void> {
    await this.setKey(
      Prefix.Token + token,
      total,
      Expiry.Token
    )
  }

  async getTotalToken(token: string): Promise<string | null> {
    return await this.getKey(Prefix.Token + token)
  }

  async setLastLowerBlockIdFromAvn(blockId: string): Promise<void> {
    await this.setKey(Key.LoweringAvnBlock, blockId)
  }

  async getLastLowerBlockIdFromAvn(): Promise<string> {
    const blockId = await this.getKey(Key.LoweringAvnBlock)
    return blockId === null ? '' : blockId
  }

  async setLowerById(lowerId: string, lowerData: any): Promise<void> {
    const senderKey = Prefix.LowerSender + lowerData?.from
    const recipientKey = Prefix.LowerRecipient + lowerData?.to?.toLowerCase()
    await this.multiExec([
      ['set', [Prefix.LowerId + lowerId, this.dataToJsonString(lowerData)]],
      ['sadd', [senderKey, lowerId]],
      ['sadd', [recipientKey, lowerId]]
    ])
  }

  async getLowerById(lowerId: any): Promise<any | undefined> {
    const lowerData = await this.getKey(Prefix.LowerId + lowerId)
    return lowerData ? JSON.parse(lowerData) : undefined
  }

  async deleteLowerById(lowerId: number): Promise<void> {
    const lowerData = await this.getLowerById(lowerId)
    if (!lowerData) return

    const senderKey = Prefix.LowerSender + lowerData?.from
    const recipientKey = Prefix.LowerRecipient + lowerData?.to?.toLowerCase()
    logger.info(
      `Deleting senderKey: ${senderKey} and recipientKey: ${recipientKey}`
    )

    await this.multiExec([
      ['del', [Prefix.LowerId + lowerId]],
      ['srem', [senderKey, lowerId]],
      ['srem', [recipientKey, lowerId]]
    ])
  }

  async getLowerIdsByAddress(address: string): Promise<string[]> {
    const senderKey = Prefix.LowerSender + address
    const recipientKey = Prefix.LowerRecipient + address
    let lowerIds = await this.smembersKey(senderKey)
    if (!lowerIds || lowerIds.length === 0) {
      lowerIds = await this.smembersKey(recipientKey)
    }
    return lowerIds || []
  }

  async getLastClaimedEthereumLowerBlock(): Promise<number> {
    const blockNumber = await this.getKey(Key.LoweringEthBlock)
    return blockNumber ? Number(blockNumber) : 0
  }

  async setLastClaimedEthereumLowerBlock(blockNumber: number): Promise<void> {
    await this.setKey(
      Key.LoweringEthBlock,
      blockNumber.toString()
    )
  }

  async setAutolowerNextT1Block(blockNumber: number): Promise<void> {
    await this.setKey(Key.AutolowerEthBlock, blockNumber.toString())
  }

  async getAutolowerNextT1Block(): Promise<number> {
    const blockNumber = await this.getKey(Key.AutolowerEthBlock)
    return blockNumber ? Number(blockNumber) : 0
  }

  async setLatestAutolowerId(lowerId: number): Promise<void> {
    await this.setKey(Key.AutolowerId, lowerId.toString())
  }

  async getLatestAutolowerId(): Promise<number> {
    const lowerId = await this.getKey(Key.AutolowerId)
    return lowerId ? Number(lowerId) : -1
  }

  async addAutolower(lowerId: number): Promise<void> {
    const result = await this.saddKey(Key.Autolower, lowerId.toString())
    if (result === 1) {
      await this.setKey(
        Prefix.AutolowerRetry + lowerId,
        'true',
        Expiry.AutolowerRetryLifetime
      )
    }
  }

  async removeAutolower(lowerId: number): Promise<void> {
    await this.sremKey(Key.Autolower, lowerId.toString())
    await this.delKey(Prefix.AutolowerRetry + lowerId)
  }

  async getAutolowers(): Promise<number[]> {
    const lowerIds = await this.smembersKey(Key.Autolower)
    const liveLowerIds: number[] = []
    for (const lowerId of lowerIds || []) {
      const exists = await this.client.exists(
        Prefix.AutolowerRetry + lowerId
      )
      if (exists) {
        liveLowerIds.push(Number(lowerId))
      } else {
        await this.removeAutolower(Number(lowerId))
      }
    }
    return liveLowerIds
  }

  async acquireAutolowerLock(bridgeAddress: string): Promise<boolean> {
    const result = await this.client.set(
      Key.AutolowerLock,
      bridgeAddress,
      'EX',
      Expiry.AutolowerLock,
      'NX'
    )
    return result === 'OK'
  }

  async releaseAutolowerLock(bridgeAddress: string): Promise<void> {
    const script = `if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end`
    await this.client.eval(script, 1, Key.AutolowerLock, bridgeAddress)
  }

  async refreshAutolowerLock(bridgeAddress: string): Promise<void> {
    const script = `if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("expire", KEYS[1], ARGV[2])
      else
        return 0
      end`
    await this.client.eval(
      script,
      1,
      Key.AutolowerLock,
      bridgeAddress,
      Expiry.AutolowerLock.toString()
    )
  }

  async setSentTxDetails(txHash: string, details: any): Promise<void> {
    await this.setKey(
      Key.Webhooks + txHash,
      this.dataToJsonString(details)
    )
  }

  async getSentTxDetails(txHash: string): Promise<any> {
    const details = await this.getKey(Key.Webhooks + txHash)
    return details ? JSON.parse(details) : {}
  }

  async deleteSentTxDetails(txHash: string): Promise<void> {
    await this.delKey(Key.Webhooks + txHash)
  }

  private dataToJsonString(data: any): string {
    if (_.isString(data)) {
      throw new Error('Data is already stringified: ' + data)
    } else {
      return JSON.stringify(data)
    }
  }
}

const redisClient = new RedisClient()
export default redisClient
export { TransactionStatus }
