const chai = require('chai');
const expect = chai.expect;
const assert = chai.assert;
chai.use(require('chai-as-promised'));
const helper = require('./helper.js');
const accounts = helper.ACCOUNTS;
const BN = helper.BN;

const STAKING_STATUS = { isStaking: 'isStaking', isNotStaking: 'isNotStaking' };
const BN_ZERO = new BN(0);
const MIN_TOTAL_AVT_SUPPLY = new BN('100000000000000000000');
const SCHEDULE_PERIOD = 28800;
const royalties = [];
const dummyT1Authority = '0xd6ae8250b8348c94847280928c79fb3b63ca453e';

describe('Query api calls:', async () => {
  let api;
  let relayer, user, newUser;
  let relayerPublicKey, userPublicKey;

  before(async () => {
    const avnApi = await helper.avnApi({
      suri: accounts.user.seed
    });
    relayer = accounts.relayer;
    user = accounts.user;
    recipient = accounts.otherUser;
    token = helper.token;
    newUser = avnApi.accountUtils.generateNewAccount();
    api = await avnApi.apis();
  });

  describe('get contract addresses', async () => {
    it('getAvtContractAddress', async () => {
      assert((await api.query.getAvtContractAddress()).length == 42);
    });

    it('getAvnContractAddress', async () => {
      assert((await api.query.getAvnContractAddress()).length == 42);
    });

    it('getNftContractAddress', async () => {
      const result = await api.query.getNftContractAddress();
      assert(result.length > 0);
      assert(result[0].length == 42);
    });
  });

  describe('get totals', async () => {
    it('returns total AVT', async () => {
      let avt = await api.query.getAvtContractAddress();
      assert(new BN(await api.query.getTotalAvt()).gt(BN_ZERO));
    });

    it('returns total ETH', async () => {
      assert(new BN(await api.query.getTotalToken('0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE')).gt(BN_ZERO));
    });

    it('returns total other token', async () => {
      assert(
        new BN(await api.query.getTotalToken(token)).gt(BN_ZERO),
        `The total token balance for ${token} should be greater than 0`
      );
    });

    it('returns zero for a non-existent token', async () => {
      const nonExistentToken = '0xd09a7B5F603E66B04e8DaFCD8653114f3C49C038';
      helper.bnEquals(await api.query.getTotalToken(nonExistentToken), 0);
    });
  });

  describe('getCurrentBlock', async () => {
    it('returns the current block', async () => {
      let currentBlock = await api.query.getCurrentBlock();
      assert(parseInt(currentBlock) > 0);
    });
  });

  describe('getChainInfo', async () => {
    it('@NO_BASELINE can get the current chain information', async () => {
      let chainInfo = await api.query.getChainInfo();
      assert(chainInfo.hasOwnProperty('name'));
      assert(chainInfo.hasOwnProperty('version'));
      assert(chainInfo.hasOwnProperty('avtContract'));
      assert(chainInfo.hasOwnProperty('avnContract'));
    });
  });

  describe('getNonce', async () => {
    it('returns the same token nonce by address as by public key', async () => {
      const nonce = await api.query.getNonce(user.address, 'token');
      assert.equal(nonce, await api.query.getNonce(user.publicKey, 'token'));
    });

    it('returns the same payment nonce by address as by public key', async () => {
      const nonce = await api.query.getNonce(user.address, 'payment');
      assert.equal(nonce, await api.query.getNonce(user.publicKey, 'payment'));
    });

    it('returns the same staking nonce by address as by public key', async () => {
      const nonce = await api.query.getNonce(user.address, 'staking');
      assert.equal(nonce, await api.query.getNonce(user.publicKey, 'staking'));
    });

    it('returns the same confirmation nonce by address as by public key', async () => {
      const nonce = await api.query.getNonce(user.address, 'confirmation');
      assert.equal(nonce, await api.query.getNonce(user.publicKey, 'confirmation'));
    });
  });

  describe('AccountInfo', async () => {
    it('returns correct data for user by address', async () => {
      const returnedData = await api.query.getAccountInfo(user.address);

      if ((await api.query.getStakingStatus(user.address)) === STAKING_STATUS.isNotStaking) {
        assert.equal(returnedData.totalBalance, returnedData.freeBalance);
        assert.equal(returnedData.stakedBalance, '0');
        assert.equal(returnedData.unlockedBalance, '0');
        assert.equal(returnedData.unstakedBalance, '0');
      } else {
        assert(new BN(returnedData.stakedBalance).gt(new BN(0)));
      }
    });
  });

  describe('getOwnedNfts', async () => {
    async function mint() {
      const externalRef = 'avn-gateway-test-' + new Date().toISOString();
      const requestId = await api.send.mintSingleNft(externalRef, royalties, dummyT1Authority);
      await helper.confirmStatus(api.poll, requestId, 'Processed');
      return await api.query.getNftId(externalRef);
    }

    it('returns the correct list of owned nft ids', async () => {
      let firstNftId = await mint();
      let secondNftId = await mint();
      const returnedData = await api.query.getOwnedNfts(user.address);
      // We can't be sure how many nfts are owned by `user` but we can make sure it contains the 2 we just minted
      assert(returnedData.length >= 2);
      assert(returnedData.includes(firstNftId));
      assert(returnedData.includes(secondNftId));
    });
  });

  describe('getStakingStats', async () => {
    const defaultMaxNominatorsRewardedPerValidatorBN = new BN(300);

    it('returns the correct data', async () => {
      const returnedData = await api.query.getStakingStats();
      // We can't be sure how about the values but we can check the structure
      const totalStakedBN = new BN(returnedData.totalStaked);
      const averageStakedBN = new BN(returnedData.averageStaked);
      const minUserBondBN = new BN(returnedData.minUserBond);
      const maxNominatorsRewardedPerValidatorBN = new BN(returnedData.maxNominatorsRewardedPerValidator);
      const totalStakersBN = new BN(returnedData.totalStakers);

      assert(totalStakedBN.gte(BN_ZERO), 'Total stake is zero');
      assert(averageStakedBN.gte(BN_ZERO), 'Average stake is zero');
      assert(averageStakedBN.lte(totalStakedBN), 'Average stake must be less than total stake');
      assert(totalStakersBN.gte(BN_ZERO), 'Total number of stakers is zero');
      assert(minUserBondBN.gt(BN_ZERO), 'Minimum user bond does not match default value');
      assert(
        maxNominatorsRewardedPerValidatorBN.eq(defaultMaxNominatorsRewardedPerValidatorBN),
        "Maximum number of nominators doesn't match default value"
      );
    });
  });

  describe('getActiveEra', async () => {
    it('returns the correct data', async () => {
      const returnedData = await api.query.getActiveEra();
      assert(parseInt(returnedData) > 0, 'Active era is not a valid result');
    });
  });

  describe('getStakingStatus', async () => {
    it('returns the correct data', async () => {
      const returnedData = await api.query.getStakingStatus('5FZ9egr9M1tGJ1aEUWG6TPkoko8j7cX2TwtchcFmaMWZzMVU');
      // We can't be sure about the values but we can check the structure
      assert(
        [STAKING_STATUS.isStaking, STAKING_STATUS.isNotStaking].includes(returnedData),
        'Staking status is not a valid result'
      );
    });
  });

  describe('getOutstandingLowersForAccount', async () => {
    it('returns data', async () => {
      const ethDevAddress = '0xDE7E1091cDE63c05Aa4D82C62e4C54eDbC701B22';
      const returnedData = await api.query.getOutstandingLowersForAccount(ethDevAddress);
      assert(Array.isArray(returnedData.lowerData));
      assert(returnedData.status === 'success');
    });
  });

  describe('getAvtBalance', async () => {
    it('returns correct avt balance for specific user by address', async () => {
      helper.bnEquals(await api.query.getAvtBalance(newUser.address), 0);
    });
    it('returns correct avt balance for specific user by publicKey', async () => {
      helper.bnEquals(await api.query.getAvtBalance(newUser.publicKey), 0);
    });
  });

  describe('getTokenBalance', async () => {
    it('returns correct token balance for specific user by address', async () => {
      helper.bnEquals(await api.query.getTokenBalance(newUser.address, token), 0);
    });
    it('returns correct token balance for specific user by publicKey', async () => {
      helper.bnEquals(await api.query.getTokenBalance(newUser.publicKey, token), 0);
    });
  });

  describe('getNonce', async () => {
    it('returns correct account nonce for specific user by address', async () => {
      helper.bnEquals(await api.query.getNonce(newUser.address, 'token'), 0);
    });
    it('returns correct account nonce for specific user by publicKey', async () => {
      helper.bnEquals(await api.query.getNonce(newUser.publicKey, 'token'), 0);
    });
  });

  describe('NFT data', async () => {
    let externalRef, requestId, nftId;

    describe('NFT data', async () => {
      let externalRef, nftId;

      before(async () => {
        externalRef = 'avn-gateway-test-' + new Date().toISOString();
        const requestId = await api.send.mintSingleNft(externalRef, royalties, dummyT1Authority);
        const receipt = await helper.confirmStatus(api.poll, requestId, 'Processed');
        nftId = receipt.eventArgs.nftId;
        assert(nftId != '');
      });

      it('can retrieve the NFT ID via the externalRef', async () => {
        assert(nftId, await api.query.getNftId(externalRef));
      });

      it('can retrieve the NFT nonce', async () => {
        helper.bnEquals(await api.query.getNftNonce(nftId), 0);
      });

      it('can retrieve the NFT owner via the decimal NFT ID', async () => {
        assert.equal(await api.query.getNftOwner(nftId), user.address);
      });

      it('can retrieve the NFT owner via the hex (bytes32) NFT ID', async () => {
        const bytesNftId = '0x' + new BN(nftId).toString(16);
        assert.equal(await api.query.getNftOwner(bytesNftId), user.address);
      });
    });
  });
});
