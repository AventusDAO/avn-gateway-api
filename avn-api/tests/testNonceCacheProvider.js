const {NonceType} = require('avn-api');

class TestNonceCacheProvider {
  constructor() {
    this.nonceMap = {};
  }

  async connect() {
    console.log("-[Test cache provider] - connected")
    return this;
  }

  async initUserNonceCache(signerAddress) {
    if (this.nonceMap[signerAddress] === undefined) {
        this.nonceMap[signerAddress] = Object.values(NonceType).reduce(
            (o, key) => ({ ...o, [key]: {
              locked: false,
            } }), {}
        );
    }
  }

  async isNonceLocked(signerAddress, nonceType) {
    return this.nonceMap[signerAddress][nonceType].locked;
  }

  async getNonceData(signerAddress, nonceType) {
    return this.nonceMap[signerAddress][nonceType]
  }

  async getNonceAndLock(signerAddress, nonceType) {
    const nonceData = this.nonceMap[signerAddress][nonceType];
    if (nonceData.locked === false) {
      const lockId = this.getLockId(signerAddress, nonceType, nonceData.nonce);
      this.nonceMap[signerAddress][nonceType].locked = true;
      this.nonceMap[signerAddress][nonceType].lockId = lockId;
      console.log("\t Nonce = ", nonceData.nonce)
      return { lockAquired: true, data: nonceData };
    }

    return { lockAquired: false, data: undefined };
  }

  async incrementNonce(lockId, signerAddress, nonceType, updateLastUpdate) {
    if (this.nonceMap[signerAddress][nonceType].locked !== true || this.nonceMap[signerAddress][nonceType].lockId !== lockId) {
        throw new Error(`Invalid attempt to increment lock. LockId: ${lockId}, signerAddress: ${signerAddress}, nonceType: ${nonceType}`)
    }

    this.nonceMap[signerAddress][nonceType].nonce += 1;
    if (updateLastUpdate === true) {
      this.nonceMap[signerAddress][nonceType].lastUpdated = Date.now();
    }

    return this.nonceMap[signerAddress][nonceType];
  }

  async unlockNonce(signerAddress, nonceType) {
    this.nonceMap[signerAddress][nonceType].locked = false;
    this.nonceMap[signerAddress][nonceType].lockId = undefined;
  }

  async setNonce(lockId, signerAddress, nonceType, nonce) {
    if (this.nonceMap[signerAddress][nonceType].locked !== true || this.nonceMap[signerAddress][nonceType].lockId !== lockId) {
        throw new Error(`Invalid attempt to set nonce. LockId: ${lockId}, signerAddress: ${signerAddress}, nonceType: ${nonceType}`)
    }

    this.nonceMap[signerAddress][nonceType] = { nonce: nonce, lastUpdated: Date.now(), locked: false };
  }

  getLockId(signerAddress, nonceType, nonce) {
    return `${Date.now()}-${nonce}-${signerAddress}-${nonceType}`;
  }

  getTime() {
    const d = new Date()
    return `${d.getHours()}:${d.getMinutes()}:${d.getSeconds()}:${d.getMilliseconds()}`
  }
}

module.exports = TestNonceCacheProvider;