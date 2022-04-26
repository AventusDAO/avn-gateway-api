const chai = require('chai');
const expect = chai.expect;
const assert = chai.assert;
chai.use(require('chai-as-promised'));
const helper = require('./helper.js');
const common = require('../lib/common.js');
const accounts = helper.ACCOUNTS;
const BN = helper.BN;

const BN_ZERO = new BN(0);
const MIN_TOTAL_AVT_SUPPLY = new BN('100000000000000000000');

describe('Query api calls:', async () => {
  let api;
  let relayer, user;
  let relayerPublicKey, userPublicKey;

  const expectedRelayerFees = {
    proxyAvtTransfer: '7000000000000000',
    proxyTokenTransfer: '7000000000000000',
    proxyConfirmTokenLift: '7000000000000000',
    proxyTokenLower: '7000000000000000',
    proxyMintSingleNft: '7000000000000000',
    proxyListNftOpenForSale: '7000000000000000',
    proxyTransferFiatNft: '7000000000000000',
    proxyCancelListFiatNft: '7000000000000000',
    proxyBond: '7000000000000000',
    proxyNominate: '7000000000000000',
    proxyIncreaseStake: '7000000000000000',
    proxyUnstake: '7000000000000000',
    proxyWithdrawUnlocked: '7000000000000000',
    proxyPayoutStakers: '7000000000000000'
  };

  const expectedUserFees = {
    proxyAvtTransfer: '7000000000000000',
    proxyTokenTransfer: '30000000000000000',
    proxyConfirmTokenLift: '7000000000000000',
    proxyTokenLower: '7000000000000000',
    proxyMintSingleNft: '7000000000000000',
    proxyListNftOpenForSale: '7000000000000000',
    proxyTransferFiatNft: '7000000000000000',
    proxyCancelListFiatNft: '7000000000000000',
    proxyBond: '7000000000000000',
    proxyNominate: '7000000000000000',
    proxyIncreaseStake: '7000000000000000',
    proxyUnstake: '7000000000000000',
    proxyWithdrawUnlocked: '7000000000000000',
    proxyPayoutStakers: '7000000000000000'
  };

  before(async () => {
    api = await helper.avnApi();
    relayer = accounts.relayer;
    user = accounts.user;
  });

  describe('get contract addresses', async () => {
    it('getAvtContractAddress', async () => {
      assert((await api.query.getAvtContractAddress()).length == 42);
    });

    it('getAvnContractAddress', async () => {
      assert((await api.query.getAvnContractAddress()).length == 42);
    });

    it('getNftContractAddress', async () => {
      assert((await api.query.getNftContractAddress()).length == 42);
    });
  });

  describe('getTotalAvt', async () => {
    it('returns total AVT supply', async () => {
      assert(new BN(await api.query.getTotalAvt()).gt(MIN_TOTAL_AVT_SUPPLY));
    });
  });

  describe('chain info', async () => {
    it('can get the current chain information', async () => {
      let chainInfo = await api.query.getChainInfo();
      assert.equal(chainInfo.name, 'AvN TestNet');
      assert.equal(chainInfo.version, '270');
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

    xit('returns the same confirmation nonce by address as by public key', async () => {
      const nonce = await api.query.getNonce(user.address, 'confirmation');
      assert.equal(nonce, await api.query.getNonce(user.publicKey, 'confirmation'));
    });
  });

  describe('getRelayerFees', async () => {
    it('returns default fees for a relayer by address', async () => {
      const returnedFees = await api.query.getRelayerFees(relayer.address);
      assert.equal(JSON.stringify(returnedFees), JSON.stringify(expectedRelayerFees));
    });

    it('returns default fees for a relayer by publicKey', async () => {
      const returnedFees = await api.query.getRelayerFees(relayer.publicKey);
      assert.equal(JSON.stringify(returnedFees), JSON.stringify(expectedRelayerFees));
    });

    it('returns fees for a specific user by address', async () => {
      const returnedFees = await api.query.getRelayerFees(relayer.address, user.address);
      assert.equal(JSON.stringify(returnedFees), JSON.stringify(expectedUserFees));
    });

    it('returns fees for a specific user by publicKey', async () => {
      const returnedFees = await api.query.getRelayerFees(relayer.publicKey, user.publicKey);
      assert.equal(JSON.stringify(returnedFees), JSON.stringify(expectedUserFees));
    });

    it('returns the fee for a specific user and transaction type', async () => {
      const transactionType = 'proxyTokenTransfer';
      const returnedFees = await api.query.getRelayerFees(relayer.address, user.publicKey, transactionType);
      assert.equal(returnedFees, expectedUserFees[transactionType]);
    });

    it('errors if relayer is not registered', async () => {
      await expect(api.query.getRelayerFees(user)).to.be.rejectedWith(Error);
    });
  });

  describe('getAvtBalance', async () => {
    //getAvtBalance(account)
    it('returns correct avt balance for specific user by address');
    it('returns correct avt balance for specific user by publicKey');
  });
  describe('getTokenBalance', async () => {
    //getTokenBalance(account, token_address)
    it('returns correct token balance for specific user by address');
    it('returns correct token balance for specific user by publicKey');
  });
  describe('getNonce', async () => {
    //getAccountNonce(account)
    it('returns correct account nonce for specific user by address');
    it('returns correct account nonce for specific user by publicKey');
  });
  describe('getNftNonce', async () => {
    //getNftNonce(nftId)
    it('returns correct nft nonce for specific nft id');
  });
  describe('getNftId', async () => {
    //getNftId(external_reference);
    it('returns correct nft id for specific reference');
  });
  describe('getNftOwner', async () => {
    //getNftOwner(nftId)
    it('returns correct nft owner for specific nft id');
  });

  describe('AccountInfo', async () => {
    it('returns correct data for user by address', async () => {
      const returnedData = await api.query.getAccountInfo(user.address);

      if ((await api.query.getStakingStatus(user.address)) === common.STAKING_STATUS.isNotStaking) {
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
    const royalties = [];
    const dummyT1Authority = '0xd6ae8250b8348c94847280928c79fb3b63ca453e';

    async function mint() {
      const externalRef = 'avn-gateway-test-' + new Date().toISOString();
      const requestId = await api.send.mintSingleNft(relayer.address, externalRef, royalties, dummyT1Authority);
      await helper.confirmStatus(api, requestId, 'Processed');
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
    const defaultMaxNominatorsRewardedPerValidatorBN = new BN(256);
    const defaultMinUserBondBN = new BN("100000000000000000000");

    it('returns the correct data', async () => {
      const returnedData = await api.query.getStakingStats();
      // We can't be sure how about the values but we can check the structure
      const totalStakedBN = new BN(returnedData.totalStaked);
      const averageStakedBN = new BN(returnedData.averageStaked);
      const minimumStakedBN = new BN(returnedData.minimumStaked);
      const minUserBondBN = new BN(returnedData.minUserBond);
      const maxNominatorsRewardedPerValidatorBN = new BN(returnedData.maxNominatorsRewardedPerValidator);
      const totalStakersBN = new BN(returnedData.totalStakers);

      assert(totalStakedBN.gte(BN_ZERO), "Total stake is zero");
      assert(averageStakedBN.gte(BN_ZERO), "Average stake is zero");
      assert(averageStakedBN.lte(totalStakedBN), "Average stake must be less than total stake");
      assert(totalStakersBN.gte(BN_ZERO), "Total number of stakers is zero");
      assert(minimumStakedBN.lte(averageStakedBN), "Minimum stake must be less than or equal to average stake");
      assert(minUserBondBN.eq(defaultMinUserBondBN), "Minimum user bond does not match default value");
      assert(maxNominatorsRewardedPerValidatorBN.eq(defaultMaxNominatorsRewardedPerValidatorBN), "Maximum number of nominators doesn't match default value");
    });
  });
});
