const { NonceType } = require('avn-api');
const Redis = require('ioredis');
const Redlock = require('redlock');

class TestRedisNonceCacheProvider {
  SLOT_PREFIX = '{avnApi}:';
  constructor() {
    this.nonceMap = {};
    this.redisClient;
  }

  async connect() {
    this.redisClient = new Redis();

    this.lockTtlMs = 5000;
    this.redlock = new Redlock([this.redisClient], {
      driftFactor: 0.01,
      retryCount: 10,
      retryDelay: 500,
      retryJitter: 200
    });

    console.info(
      'Connected to Redis database:\n',
      (await this.redisClient.hello()).map((e, i) => (i % 2 == 0 ? e + ':' : e + ', ')).join('')
    );

    return this;
  }

  async initUserNonceCache(signerAddress) {
    const signerKey = this.getSignerKey(signerAddress);
    if ((await this.redisClient.get(signerKey)) !== true) {
      // Set the signer
      await this.redisClient.set(this.getSignerKey(signerAddress), true);

      // Set the nonces
      for (const nonceType of Object.values(NonceType)) {
        await this.saveNonceDataToRedis(signerAddress, nonceType, { locked: false });
      }
    }
  }

  async getNonceData(signerAddress, nonceType) {
    const nonceData = await this.readNonceDatafromRedis(signerAddress, nonceType);
    return nonceData;
  }

  async getNonceAndLock(signerAddress, nonceType) {
    const lock = await this.redlock.acquire([`redlock-${signerAddress}${nonceType}`], this.lockTtlMs);
    try {
      let nonceData = await this.readNonceDatafromRedis(signerAddress, nonceType);
      if (nonceData.locked === false) {
        const lockId = this.getLockId(signerAddress, nonceType, nonceData.nonce);

        nonceData.locked = true;
        nonceData.lockId = lockId;

        await this.saveNonceDataToRedis(signerAddress, nonceType, nonceData);
        return { lockAquired: true, data: nonceData };
      }
      return { lockAquired: false, data: undefined };
    } finally {
      await lock.unlock();
    }
  }

  async incrementNonce(lockId, signerAddress, nonceType, updateLastUpdate) {
    let nonceData = await this.readNonceDatafromRedis(signerAddress, nonceType);
    if (nonceData.locked !== true || nonceData.lockId !== lockId) {
      throw new Error(
        `Invalid attempt to increment nonce. Current lock: ${nonceData.lockId} LockId: ${lockId}, signerAddress: ${signerAddress}, nonceType: ${nonceType}`
      );
    }

    nonceData.nonce = parseInt(nonceData.nonce) + 1;
    if (updateLastUpdate === true) {
      nonceData.lastUpdated = Date.now();
    }

    await this.saveNonceDataToRedis(signerAddress, nonceType, nonceData);
    return nonceData;
  }

  async unlockNonce(lockId, signerAddress, nonceType) {
    let nonceData = await this.readNonceDatafromRedis(signerAddress, nonceType);
    if (nonceData.locked !== true || nonceData.lockId !== lockId) {
      throw new Error(
        `Invalid attempt to unlock nonce. Current lock: ${nonceData.lockId}. LockId: ${lockId}, signerAddress: ${signerAddress}, nonceType: ${nonceType}`
      );
    }
    nonceData.locked = false;
    nonceData.lockId = undefined;
    await this.saveNonceDataToRedis(signerAddress, nonceType, nonceData);
  }

  async setNonce(lockId, signerAddress, nonceType, nonce) {
    let nonceData = await this.readNonceDatafromRedis(signerAddress, nonceType);
    if (nonceData.locked !== true || nonceData.lockId !== lockId) {
      throw new Error(
        `Invalid attempt to set nonce. Current lock: ${nonceData.lockId}. LockId: ${lockId}, signerAddress: ${signerAddress}, nonceType: ${nonceType}`
      );
    }

    nonceData = { nonce: nonce, lastUpdated: Date.now() };
    await this.saveNonceDataToRedis(signerAddress, nonceType, nonceData);
  }

  getLockId(signerAddress, nonceType, nonce) {
    return `${Date.now()}-${nonce}-${signerAddress}-${nonceType}`;
  }

  getNonceKey(signerAddress, nonceType) {
    return `${this.getSignerKey(signerAddress)}-${nonceType}`;
  }

  getSignerKey(signerAddress) {
    return `${this.SLOT_PREFIX}-${signerAddress}`;
  }

  async readNonceDatafromRedis(signerAddress, nonceType) {
    const nonceKey = this.getNonceKey(signerAddress, nonceType);
    const nonceData = await this.redisClient.hgetall(nonceKey);
    // deal with boolean values
    nonceData.locked = nonceData.locked === 'true';
    return nonceData;
  }

  async saveNonceDataToRedis(signerAddress, nonceType, nonceData) {
    const nonceKey = this.getNonceKey(signerAddress, nonceType);
    await this.redisClient.hset(nonceKey, nonceData);
  }
}

module.exports = TestRedisNonceCacheProvider;
