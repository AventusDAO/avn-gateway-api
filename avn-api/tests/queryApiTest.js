const chai = require('chai');
const expect = chai.expect;
const assert = chai.assert;
chai.use(require('chai-as-promised'));
const helper = require('./helper.js');
const accounts = helper.ACCOUNTS;
const BN = helper.BN;

const BN_ZERO = new BN(0);
const royalties = [];
const dummyT1Authority = '0xd6ae8250b8348c94847280928c79fb3b63ca453e';

describe('Query api calls:', async () => {
  let api;
  let relayer, user, newUser;

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
      if (result.length > 0) {
        // Because some chains dont have nft contracts
        assert(result[0].length == 42);
      }
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
      const nonce = await api.query.getUserNonce(user.address, 'token');
      assert.equal(nonce, await api.query.getUserNonce(user.publicKey, 'token'));
    });

    it('returns the same payment nonce by address as by public key', async () => {
      const nonce = await api.query.getUserNonce(user.address, 'payment');
      assert.equal(nonce, await api.query.getUserNonce(user.publicKey, 'payment'));
    });

    it('returns the same staking nonce by address as by public key', async () => {
      const nonce = await api.query.getUserNonce(user.address, 'staking');
      assert.equal(nonce, await api.query.getUserNonce(user.publicKey, 'staking'));
    });

    it('returns the same confirmation nonce by address as by public key', async () => {
      const nonce = await api.query.getUserNonce(user.address, 'confirmation');
      assert.equal(nonce, await api.query.getUserNonce(user.publicKey, 'confirmation'));
    });
  });

  describe('AccountInfo', async () => {
    it('returns correct data for user by address', async () => {
      const returnedData = await api.query.getAccountInfo(user.address);
      assert(returnedData.freeBalance);
      assert(returnedData.totalBalance);
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
      helper.bnEquals(await api.query.getUserNonce(newUser.address, 'token'), 0);
    });
    it('returns correct account nonce for specific user by publicKey', async () => {
      helper.bnEquals(await api.query.getUserNonce(newUser.publicKey, 'token'), 0);
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
