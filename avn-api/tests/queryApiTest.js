const chai = require('chai');
const expect = chai.expect;
const assert = chai.assert;
chai.use(require('chai-as-promised'));
const helper = require('./helper.js');
const common = require('../lib/common.js');
const accounts = helper.ACCOUNTS;
const BN = helper.BN;

const MIN_TOTAL_AVT_SUPPLY = new BN('100000000000000000000');

describe('Query api calls:', async () => {
  let api;
  let relayer, user;
  let relayerPublicKey, userPublicKey;

  const expectedRelayerFees = {
    proxyAvtTransfer: '7000000000000000',
    proxyTokenTransfer: '7000000000000000',
    proxyConfirmTokenLift: '1000000000000000',
    proxyTokenLower: '1000000000000000',
    proxyMintSingleNft: '7000000000000000',
    proxyListNftOpenForSale: '7000000000000000',
    proxyTransferFiatNft: '7000000000000000',
    proxyCancelListFiatNft: '7000000000000000',
    proxyBond: '1000000000000000',
    proxyNominate: '1000000000000000',
    proxyIncreaseStake: '1000000000000000',
    proxyUnstake: '1000000000000000',
    proxyWithdrawUnlocked: '1000000000000000',
    proxyPayoutStakers: '1000000000000000'
  };

  const expectedUserFees = {
    proxyAvtTransfer: '7000000000000000',
    proxyTokenTransfer: '30000000000000000',
    proxyConfirmTokenLift: '1000000000000000',
    proxyTokenLower: '1000000000000000',
    proxyMintSingleNft: '7000000000000000',
    proxyListNftOpenForSale: '7000000000000000',
    proxyTransferFiatNft: '7000000000000000',
    proxyCancelListFiatNft: '7000000000000000',
    proxyBond: '1000000000000000',
    proxyNominate: '1000000000000000',
    proxyIncreaseStake: '1000000000000000',
    proxyUnstake: '1000000000000000',
    proxyWithdrawUnlocked: '1000000000000000',
    proxyPayoutStakers: '1000000000000000'
  };

  before(async () => {
    api = await helper.avnApi();
    relayer = accounts.relayer;
    user = accounts.sender;
    sender = accounts.sender;
  });

  describe('getTotalAvt', async () => {
    it('returns total AVT supply', async () => {
      assert(new BN(await api.query.getTotalAvt()).gt(MIN_TOTAL_AVT_SUPPLY));
    });
  });

  describe('getNonce', async () => {
    it('returns the same token nonce by address as by public key', async () => {
      const nonce = await api.query.getNonce(sender.address, 'token');
      assert.equal(nonce, await api.query.getNonce(sender.publicKey, 'token'));
    });

    it('returns the same payment nonce by address as by public key', async () => {
      const nonce = await api.query.getNonce(sender.address, 'payment');
      assert.equal(nonce, await api.query.getNonce(sender.publicKey, 'payment'));
    });

    it('returns the same staking nonce by address as by public key', async () => {
      const nonce = await api.query.getNonce(sender.address, 'staking');
      assert.equal(nonce, await api.query.getNonce(sender.publicKey, 'staking'));
    });

    xit('returns the same confirmation nonce by address as by public key', async () => {
      const nonce = await api.query.getNonce(sender.address, 'confirmation');
      assert.equal(nonce, await api.query.getNonce(sender.publicKey, 'confirmation'));
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
  describe('getAvtContractAddress', async () => {
    //getAvtContractAddress()
    it('returns correct avt contract address');
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

      if (await api.query.getStakingStatus(user.address) === common.STAKING_STATUS.isNotStaking) {
        assert.equal(returnedData.totalBalance, returnedData.freeBalance);
        assert.equal(returnedData.stakedBalance, '0');
        assert.equal(returnedData.unlockedBalance, '0');
        assert.equal(returnedData.unstakedBalance, '0');
      } else {
        assert(new BN(returnedData.stakedBalance).gt(new BN(0)));
      }
    });
  });
});
