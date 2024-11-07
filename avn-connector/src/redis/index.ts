const config = require('multiconfig').load({ directory: '../config' });
import { Cluster, Redis } from 'ioredis';
import logger from '../logger';
import {
  AUTOLOWERS_KEY,
  AUTOLOWER_LOCK_KEY,
  AUTOLOWER_MAX_LOCK_IN_SECONDS,
  AUTOLOWER_RETRY_LIFETIME_NAMESPACE,
  AUTOLOWER_RETRY_LIFETIME_SECONDS,
  CHAIN_INFO_EXPIRY_IN_SECONDS,
  CHAIN_INFO_KEY,
  COLLATORS_EXPIRY_IN_SECONDS,
  COLLATORS_KEY,
  LAST_CLAIMED_ETH_LOWER_BLOCK_PREFIX,
  LAST_LOWER_BLOCK_ID_FROM_AVN,
  LATEST_LOWER_ID_FOR_AUTOLOWER_KEY,
  LIFTS_FROM_TIER1_BLOCK_KEY,
  LOWER_ID_PREFIX,
  LOWER_RECIPIENT_PREFIX,
  LOWER_SENDER_PREFIX,
  MAX_PENDING_TX_TO_CHECK,
  NEXT_T1_BLOCK_FOR_AUTOLOWER_KEY,
  NONCE_EXPIRY_IN_SECONDS,
  NONCE_NAMESPACE,
  PAYER_NONCE_NAMESPACE,
  PENDING_TX_CHECKING_WINDOW_IN_SECONDS,
  PENDING_TX_KEY,
  SLOT_PREFIX,
  STAKING_STAT_EXPIRY_IN_SECONDS,
  STAKING_STAT_KEY,
  TOTAL_TOKEN_EXPIRY_IN_SECONDS,
  TOTAL_TOKEN_NAMESPACE,
  WEBHOOKS_SENT_TX_KEY,
  TransactionStatus,
  LAST_SUMMARY_PREFIX
} from './constants';
import { ChainSummary, transactionObject } from './types';
import { LowerData } from '../types';
import _ from 'lodash';

class RedisClient {
  client: Redis | Cluster;

  async connect() {
    this.client = await this.initializeClient();
    await this.logConnection(this.client);
    this.defineCommands();
  }
  private async initializeClient(): Promise<Redis | Cluster> {
    if ('redis' in config) {
      logger.info(
        `Attempting to connect to Redis database on ${config.redis.url}:${config.redis.port}`
      );
      const client = new Cluster([
        { port: Number(config.redis.port), host: `${config.redis.url}` }
      ]);
      return client;
    } else {
      return new Redis();
    }
  }

  private async logConnection(client: Redis | Cluster) {
    logger.info(
      'Connected to Redis database:\n',
      (await client.hello())
        .map((e: any, i: number) => (i % 2 == 0 ? e + ':' : e + ', '))
        .join('')
    );
  }

  private defineCommands() {
    if (!this.client) {
      throw new Error('Redis client is not initialized');
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
    });

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
    });
  }

  async setKey(key: string, value: string, expiry?: number): Promise<void> {
    if (expiry) {
      await this.client.setex(key, expiry, value);
    } else {
      await this.client.set(key, value);
    }
  }

  async getKey(key: string): Promise<string | null> {
    return await this.client.get(key);
  }

  async delKey(key: string): Promise<void> {
    await this.client.del(key);
  }

  async hsetKey(key: string, value: Record<string, any>): Promise<void> {
    await this.client.hset(key, value);
  }

  async hgetKey(key: string): Promise<Record<string, any>> {
    return await this.client.hgetall(key);
  }

  async saddKey(key: string, value: string): Promise<number> {
    return await this.client.sadd(key, value);
  }

  async sremKey(key: string, value: string): Promise<void> {
    await this.client.srem(key, value);
  }

  async smembersKey(key: string): Promise<string[]> {
    return await this.client.smembers(key);
  }

  async multiExec(commands: [string, any[]][]): Promise<any> {
    try {
      const multi = this.client.multi();
      commands.forEach(([command, args]) => {
        logger.debug(
          `Adding command to pipeline: ${command} with args: ${args}`
        );
        (multi as any)[command](...args);
      });

      const results = await multi.exec();
      // Check for errors in the pipeline results
      if (results) {
        for (const [error, result] of results) {
          if (error) {
            logger.error(`Redis command error: ${error.message}`);
            throw new Error(`Redis command error: ${error.message}`);
          }
        }
      }
      return results;
    } catch (error: any) {
      logger.error(`Error executing Redis multi: ${error.message}`, {
        command: { name: 'exec', args: [] },
        previousErrors: error.errors || []
      });
      throw error;
    }
  }

  async addNewAvnTransaction(
    requestId: string,
    requestIdHash: string
  ): Promise<void> {
    const transactionHashKey = `${SLOT_PREFIX}${requestIdHash}`;
    const requestIdKey = `${SLOT_PREFIX}${requestId}`;

    logger.info(
      `[redis] [addNewAvnTransaction] - requestId: ${requestId}, transactionHash: ${requestIdHash}`
    );

    if (await this.client.exists(transactionHashKey)) {
      logger.error(
        `Transaction hash (${transactionHashKey}) exists already, cannot add duplicate value.`
      );
      return;
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
    ]);
  }

  async addFailedAvnTransaction(
    requestId: string,
    txHashOrRequestId: string,
    senderAddress: string | undefined,
    senderNonce: string | undefined,
    reason: string
  ): Promise<void> {
    const txHashOrRequestIdKey = `${SLOT_PREFIX}${txHashOrRequestId}`;
    const requestIdKey = `${SLOT_PREFIX}${requestId}`;

    logger.info(
      `[redis] [addFailedAvnTransaction] - requestId: ${requestId}, transactionHash: ${txHashOrRequestId}, senderAddress: ${senderAddress}, senderNonce: ${senderNonce}, reason: ${reason}`
    );

    if (await this.client.exists(txHashOrRequestIdKey)) {
      logger.warn(
        `Updating status of transaction: ${txHashOrRequestId} (${requestId}) to ${reason}`
      );
      await this.hsetKey(
        txHashOrRequestIdKey,
        this.buildTransactionJson(senderAddress, senderNonce, reason)
      );
      return;
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
    ]);
  }

  async updateTransactionStatusToPending(
    requestId: string,
    transactionHash: string,
    senderAddress: string,
    senderNonce: string
  ): Promise<void> {
    const transactionHashKey = `${SLOT_PREFIX}${transactionHash}`;
    const requestIdKey = `${SLOT_PREFIX}${requestId}`;

    logger.info(
      `[redis] [updateTransactionStatusToPending] - requestId: ${requestId}, transactionHash: ${transactionHash}, senderAddress: ${senderAddress}, senderNonce: ${senderNonce}`
    );

    const age = Date.now();
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
      ['zadd', [PENDING_TX_KEY.ALL, age, transactionHash]],
      ['set', [requestIdKey, transactionHash]]
    ]);
  }

  async getAvnTransaction(
    txHashOrRequestId: string | null
  ): Promise<Record<string, string> | null> {
    if (txHashOrRequestId === null) return null;
    const txHashOrRequestIdKey = `${SLOT_PREFIX}${txHashOrRequestId}`;
    const result = await this.hgetKey(txHashOrRequestIdKey);
    return Object.keys(result).length === 0 ? null : result;
  }

  async resolvePendingAvnTransactions(transactions: any[]): Promise<void> {
    if (!transactions) {
      logger.info(`[redis] No transactions to update`);
      return;
    }

    logger.info(`[redis] Updating ${transactions.length} transactions`);
    for (const tx of transactions) {
      const transactionHashKey = `${SLOT_PREFIX}${tx.transactionHash}`;

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
        });
        continue;
      }

      const newValue: Record<string, any> = {};
      newValue[transactionObject.status] = tx.status;
      newValue[transactionObject.blockNumber] = tx.blockNumber;
      newValue[transactionObject.transactionIndex] = tx.index;
      newValue[transactionObject.eventArgs] = this.dataToJsonString(
        tx.eventArgs
      );

      if (tx.status === TransactionStatus.Validating) {
        logger.info(
          `[redis] Updating tx status to validated: txHash: ${tx.transactionHash}`
        );

        const pendingTx = await this.hgetKey(transactionHashKey);
        if (
          ![
            TransactionStatus.Processed,
            TransactionStatus.Rejected,
            TransactionStatus.Validating
          ].includes(pendingTx.status)
        ) {
          await this.hsetKey(transactionHashKey, newValue);
        }
      } else {
        await this.multiExec([
          ['hset', [transactionHashKey, newValue]],
          ['zrem', [PENDING_TX_KEY.ALL, tx.transactionHash]],
          ['zrem', [PENDING_TX_KEY.CHECKING, tx.transactionHash]],
          ['zrem', [PENDING_TX_KEY.NEXT, tx.transactionHash]]
        ]);
      }
    }
  }

  async getNextTransactionsToCheck(): Promise<string[]> {
    const timeNow = Date.now();
    const expiry = timeNow + PENDING_TX_CHECKING_WINDOW_IN_SECONDS * 1000;

    const [numUpdated, numExpired, numAwaitingCheck, txToCheckNext] =
      await this.multiExec([
        [
          'addzrangebyscore',
          [PENDING_TX_KEY.CHECKING, PENDING_TX_KEY.ALL, '-inf', timeNow]
        ],
        ['zremrangebyscore', [PENDING_TX_KEY.CHECKING, '-inf', timeNow]],
        [
          'zdiffstore',
          [PENDING_TX_KEY.NEXT, 2, PENDING_TX_KEY.ALL, PENDING_TX_KEY.CHECKING]
        ],
        [
          'nextzsubset',
          [
            PENDING_TX_KEY.NEXT,
            PENDING_TX_KEY.CHECKING,
            MAX_PENDING_TX_TO_CHECK,
            expiry
          ]
        ]
      ]);

    if (numUpdated[1] !== numExpired[1]) {
      logger.warn(
        `[redis] Count of expired (${numExpired[1]}) and updated (${numUpdated[1]}) transactions differs\n`
      );
    }
    logger.info(`[redis] Transactions with updated expiry: ${numUpdated[1]}\n`);
    logger.info(
      `[redis] Transactions awaiting check: ${numAwaitingCheck[1]}\n`
    );
    logger.info(`[redis] Next transactions to check: ${txToCheckNext[1]}\n`);
    return txToCheckNext[1];
  }

  async getTransactionHashByRequestId(
    requestId: string
  ): Promise<string | null> {
    const requestIdKey = `${SLOT_PREFIX}${requestId}`;
    return await this.getKey(requestIdKey);
  }

  private buildTransactionJson(
    senderAddress: string | undefined,
    senderNonce: string | undefined,
    status: string
  ): Record<string, string> {
    const result: Record<string, string> = {};
    result[transactionObject.senderAddress] = senderAddress || '';
    result[transactionObject.senderNonce] = senderNonce || '';
    result[transactionObject.status] = status;
    return result;
  }

  async getNextNonce(senderAddress: string): Promise<number | null> {
    const nonce = await this.getKey(NONCE_NAMESPACE + senderAddress);
    return nonce == null ? null : Number(nonce);
  }

  async setNextNonce(senderAddress: string, nonce: number): Promise<void> {
    await this.setKey(
      NONCE_NAMESPACE + senderAddress,
      nonce.toString(),
      NONCE_EXPIRY_IN_SECONDS
    );
  }

  async getNextPayerNonce(payerAddress: string): Promise<number | null> {
    const nonce = await this.getKey(PAYER_NONCE_NAMESPACE + payerAddress);
    return nonce == null ? null : Number(nonce);
  }

  async setNextPayerNonce(payerAddress: string, nonce: number): Promise<void> {
    await this.setKey(
      PAYER_NONCE_NAMESPACE + payerAddress,
      nonce.toString(),
      NONCE_EXPIRY_IN_SECONDS
    );
  }

  async setCollatorsToNominate(collators: any): Promise<void> {
    await this.setKey(
      COLLATORS_KEY,
      this.dataToJsonString(collators),
      COLLATORS_EXPIRY_IN_SECONDS
    );
  }

  async getCollatorsToNominate(): Promise<any | null> {
    const collators = await this.getKey(COLLATORS_KEY);
    return collators ? JSON.parse(collators) : null;
  }

  async setStakingStats(stakingStats: any): Promise<void> {
    await this.setKey(
      STAKING_STAT_KEY,
      this.dataToJsonString(stakingStats),
      STAKING_STAT_EXPIRY_IN_SECONDS
    );
  }

  async getStakingStats(): Promise<any | null> {
    const stakingStats = await this.getKey(STAKING_STAT_KEY);
    return stakingStats ? JSON.parse(stakingStats) : null;
  }

  async setChainInfo(chainInfo: any): Promise<void> {
    await this.setKey(
      CHAIN_INFO_KEY,
      this.dataToJsonString(chainInfo),
      CHAIN_INFO_EXPIRY_IN_SECONDS
    );
  }

  async getChainInfo(): Promise<any | null> {
    const chainInfo = await this.getKey(CHAIN_INFO_KEY);
    return chainInfo ? JSON.parse(chainInfo) : null;
  }

  async setLiftsFromTier1Block(blockNumber: number): Promise<void> {
    await this.setKey(LIFTS_FROM_TIER1_BLOCK_KEY, blockNumber.toString());
  }

  async getLiftsFromTier1Block(): Promise<number> {
    const blockNumber = await this.getKey(LIFTS_FROM_TIER1_BLOCK_KEY);
    return blockNumber ? Number(blockNumber) : 0;
  }

  async setTotalToken(token: string, total: string): Promise<void> {
    await this.setKey(
      TOTAL_TOKEN_NAMESPACE + token,
      total,
      TOTAL_TOKEN_EXPIRY_IN_SECONDS
    );
  }

  async getTotalToken(token: string): Promise<string | null> {
    return await this.getKey(TOTAL_TOKEN_NAMESPACE + token);
  }

  async setLastLowerBlockIdFromAvn(blockId: string): Promise<void> {
    await this.setKey(LAST_LOWER_BLOCK_ID_FROM_AVN, blockId);
  }

  async getLastLowerBlockIdFromAvn(): Promise<string> {
    const blockId = await this.getKey(LAST_LOWER_BLOCK_ID_FROM_AVN);
    return blockId === null ? '' : blockId;
  }

  async setLowerById(lowerId: string, lowerData: any): Promise<void> {
    const senderKey = LOWER_SENDER_PREFIX + lowerData?.from;
    const recipientKey = LOWER_RECIPIENT_PREFIX + lowerData?.to?.toLowerCase();
    await this.multiExec([
      ['set', [LOWER_ID_PREFIX + lowerId, this.dataToJsonString(lowerData)]],
      ['sadd', [senderKey, lowerId]],
      ['sadd', [recipientKey, lowerId]]
    ]);
  }

  async getLowerById(lowerId: any): Promise<LowerData | null> {
    const lowerData = await this.getKey(LOWER_ID_PREFIX + lowerId);
    return lowerData ? JSON.parse(lowerData) : null;
  }

  async deleteLowerById(lowerId: number): Promise<void> {
    const lowerData = await this.getLowerById(lowerId);
    if (!lowerData) return;

    const senderKey = LOWER_SENDER_PREFIX + lowerData?.from;
    const recipientKey = LOWER_RECIPIENT_PREFIX + lowerData?.to?.toLowerCase();
    logger.info(
      `Deleting senderKey: ${senderKey} and recipientKey: ${recipientKey}`
    );

    await this.multiExec([
      ['del', [LOWER_ID_PREFIX + lowerId]],
      ['srem', [senderKey, lowerId]],
      ['srem', [recipientKey, lowerId]]
    ]);
  }

  async getLowerIdsByAddress(address: string): Promise<string[]> {
    const senderKey = LOWER_SENDER_PREFIX + address;
    const recipientKey = LOWER_RECIPIENT_PREFIX + address;
    let lowerIds = await this.smembersKey(senderKey);
    if (!lowerIds || lowerIds.length === 0) {
      lowerIds = await this.smembersKey(recipientKey);
    }
    return lowerIds || [];
  }

  async getLastClaimedEthereumLowerBlock(): Promise<number> {
    const blockNumber = await this.getKey(LAST_CLAIMED_ETH_LOWER_BLOCK_PREFIX);
    return blockNumber ? Number(blockNumber) : 0;
  }

  async setLastClaimedEthereumLowerBlock(blockNumber: number): Promise<void> {
    await this.setKey(
      LAST_CLAIMED_ETH_LOWER_BLOCK_PREFIX,
      blockNumber.toString()
    );
  }

  async setAutolowerNextT1Block(blockNumber: number): Promise<void> {
    await this.setKey(NEXT_T1_BLOCK_FOR_AUTOLOWER_KEY, blockNumber.toString());
  }

  async getAutolowerNextT1Block(): Promise<number> {
    const blockNumber = await this.getKey(NEXT_T1_BLOCK_FOR_AUTOLOWER_KEY);
    return blockNumber ? Number(blockNumber) : 0;
  }

  async setLatestAutolowerId(lowerId: number): Promise<void> {
    await this.setKey(LATEST_LOWER_ID_FOR_AUTOLOWER_KEY, lowerId.toString());
  }

  async getLatestAutolowerId(): Promise<number> {
    const lowerId = await this.getKey(LATEST_LOWER_ID_FOR_AUTOLOWER_KEY);
    return lowerId ? Number(lowerId) : -1;
  }

  async addAutolower(lowerId: number): Promise<void> {
    const result = await this.saddKey(AUTOLOWERS_KEY, lowerId.toString());
    if (result === 1) {
      await this.setKey(
        AUTOLOWER_RETRY_LIFETIME_NAMESPACE + lowerId,
        'true',
        AUTOLOWER_RETRY_LIFETIME_SECONDS
      );
    }
  }

  async removeAutolower(lowerId: number): Promise<void> {
    await this.sremKey(AUTOLOWERS_KEY, lowerId.toString());
    await this.delKey(AUTOLOWER_RETRY_LIFETIME_NAMESPACE + lowerId);
  }

  async getAutolowers(): Promise<number[]> {
    const lowerIds = await this.smembersKey(AUTOLOWERS_KEY);
    const liveLowerIds: number[] = [];
    for (const lowerId of lowerIds || []) {
      const exists = await this.client.exists(
        AUTOLOWER_RETRY_LIFETIME_NAMESPACE + lowerId
      );
      if (exists) {
        liveLowerIds.push(Number(lowerId));
      } else {
        await this.removeAutolower(Number(lowerId));
      }
    }
    return liveLowerIds;
  }

  async acquireAutolowerLock(bridgeAddress: string): Promise<boolean> {
    const result = await this.client.set(
      AUTOLOWER_LOCK_KEY,
      bridgeAddress,
      'EX',
      AUTOLOWER_MAX_LOCK_IN_SECONDS,
      'NX'
    );
    return result === 'OK';
  }

  async releaseAutolowerLock(bridgeAddress: string): Promise<void> {
    const script = `if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end`;
    await this.client.eval(script, 1, AUTOLOWER_LOCK_KEY, bridgeAddress);
  }

  async refreshAutolowerLock(bridgeAddress: string): Promise<void> {
    const script = `if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("expire", KEYS[1], ARGV[2])
      else
        return 0
      end`;
    await this.client.eval(
      script,
      1,
      AUTOLOWER_LOCK_KEY,
      bridgeAddress,
      AUTOLOWER_MAX_LOCK_IN_SECONDS.toString()
    );
  }

  async setSentTxDetails(txHash: string, details: any): Promise<void> {
    await this.setKey(
      WEBHOOKS_SENT_TX_KEY + txHash,
      this.dataToJsonString(details)
    );
  }

  async getSentTxDetails(txHash: string): Promise<any> {
    const details = await this.getKey(WEBHOOKS_SENT_TX_KEY + txHash);
    return details ? JSON.parse(details) : {};
  }

  async deleteSentTxDetails(txHash: string): Promise<void> {
    await this.delKey(WEBHOOKS_SENT_TX_KEY + txHash);
  }

  private dataToJsonString(data: any): string {
    if (_.isString(data)) {
      throw new Error('Data is already stringified: ' + data);
    } else {
      return JSON.stringify(data);
    }
  }

  async getLastSubmittedSummary(chainId: string): Promise<ChainSummary | null> {
    logger.info('Attempting to get last submitted summary for chain:', chainId);
    try {
      const summaryString = await this.getKey(
        `${LAST_SUMMARY_PREFIX}${chainId}`
      );
      logger.info('Retrieved summary string:', summaryString);
      return summaryString ? {rootId:chainId, rootHash: summaryString } as unknown as ChainSummary : null;
    } catch (error) {
      logger.error('Error getting last submitted summary:', error);
      throw error;
    }
  }

  async setLastSubmittedSummary(
    chainId: string,
    summary: string
  ): Promise<void> {
    try {
      await this.setKey(
        `${LAST_SUMMARY_PREFIX}${chainId}`,
        summary
      );
      logger.info(
        'Successfully set last submitted summary for chain:',
        chainId
      );
    } catch (error) {
      logger.error('Error setting last submitted summary:', error);
      throw error;
    }
  }
}

const redisClient = new RedisClient();
export default redisClient;
export { TransactionStatus };
