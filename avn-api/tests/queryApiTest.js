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
const SCHEDULE_PERIOD = 28800;

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
    recipient = accounts.otherUser;
    token = helper.token;
  });

  describe('get contract addresses', async () => {
    it('@NO_BASELINE getAvtContractAddress', async () => {
      assert((await api.query.getAvtContractAddress()).length == 42);
    });

    it('@NO_BASELINE getAvnContractAddress', async () => {
      assert((await api.query.getAvnContractAddress()).length == 42);
    });

    it('@NO_BASELINE getNftContractAddress', async () => {
      const result = await api.query.getNftContractAddress();
      assert(result.length > 0);
      assert(result[0].length == 42);
    });
  });

  describe('get totals', async () => {
    it('@NO_BASELINE returns total AVT', async () => {
      let avt = await api.query.getAvtContractAddress();
      helper.bnEquals(await api.query.getTotalAvt(), await api.query.getTotalToken(avt));
    });

    it('@NO_BASELINE returns total ETH', async () => {
      assert(new BN(await api.query.getTotalToken('0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE')).gt(BN_ZERO));
    });

    it('@NO_BASELINE returns total other token', async () => {
      assert(new BN(await api.query.getTotalToken(token)).gt(BN_ZERO));
    });

    it('@NO_BASELINE returns zero for a non-existent token', async () => {
      const nonExistentToken = '0xd09a7B5F603E66B04e8DaFCD8653114f3C49C038';
      helper.bnEquals(await api.query.getTotalToken(nonExistentToken), 0);
    });
  });

  describe('getCurrentBlock', async () => {
    it('@NO_BASELINE returns the current block', async () => {
      let currentBlock = await api.query.getCurrentBlock();
      assert(parseInt(currentBlock) > 0);
    });
  });

  describe('getChainInfo', async () => {
    it('@NO_BASELINE can get the current chain information', async () => {
      let chainInfo = await api.query.getChainInfo();
      assert.equal(chainInfo.name, 'AvN TestNet');
      assert.equal(chainInfo.version, '270');
    });
  });

  describe('getSummaryData', async () => {
    // TODO: Update these tests when we allow the schedule period to be flexible


    it('@NO_BASELINE returns the correct data for a block falling within a published summary', async () => {
      let currentBlock = parseInt(await api.query.getCurrentBlock());
      // Only runs if a summary should have been published by now
      if (currentBlock > SCHEDULE_PERIOD * 3 + 1000) {
        const block = currentBlock - SCHEDULE_PERIOD;
        let summaryData = await api.query.getSummaryData(block);
        assert.equal(summaryData.blockNumber, block.toString());
        assert.equal(summaryData.summaryRange[0], '0');
        assert.equal(summaryData.summaryRange[1], SCHEDULE_PERIOD.toString());
        assert.equal(summaryData.ethTxHash.length, 66);
      }
    });

    it('@NO_BASELINE returns the correct data for the current block', async () => {
      let block = await api.query.getCurrentBlock();
      let summaryData = await api.query.getSummaryData(block);
      assert.equal(summaryData.blockNumber, block);
      const multiplier = Math.floor(parseInt(block) / SCHEDULE_PERIOD);
      const startBlock = block < SCHEDULE_PERIOD ? 0 : multiplier * SCHEDULE_PERIOD + 1;
      assert.equal(summaryData.summaryRange[0], startBlock);
      assert.equal(summaryData.summaryRange[1], (multiplier + 1) * SCHEDULE_PERIOD);
      assert.equal(summaryData.ethTxHash, null);
    });

    it('@NO_BASELINE returns the current block data when no block is passed', async () => {
      let block = await api.query.getCurrentBlock();
      let summaryData = await api.query.getSummaryData();
      assert(parseInt(summaryData.blockNumber) >= parseInt(block));
      const multiplier = Math.floor(parseInt(block) / SCHEDULE_PERIOD);
      const startBlock = block < SCHEDULE_PERIOD ? 0 : multiplier * SCHEDULE_PERIOD + 1;
      assert.equal(summaryData.summaryRange[0], startBlock);
      assert.equal(summaryData.summaryRange[1], (multiplier + 1) * SCHEDULE_PERIOD);
      assert.equal(summaryData.ethTxHash, null);
    });

    it('@NO_BASELINE returns limited data when a future block is passed', async () => {
      let block = await api.query.getCurrentBlock();
      block = parseInt(block) + 100000;
      let summaryData = await api.query.getSummaryData(block);
      assert.equal(summaryData.blockNumber, block.toString());
      assert.equal(summaryData.summaryRange.length, 0);
      assert.equal(summaryData.ethTxHash, null);
    });
  });

  describe('getSummaryInclusionData', async () => {
    // TODO: Replace with testing mechanism to generate more recent lowers
    it('@NO_BASELINE gets correct data for a known lower', async () => {
      const blockNumber = '6042';
      const transactionIndex = '1';
      let inclusionData = await api.query.getSummaryInclusionData(blockNumber, transactionIndex);
      assert.equal(inclusionData.status, 'Published');
      assert.equal(inclusionData.inclusionProof.leafHash.length, 66);
      assert.equal(inclusionData.inclusionProof.leaf.length, 946);
      assert.equal(inclusionData.inclusionProof.merklePath.length, 1073);
      assert.equal(inclusionData.transactionDetails.args[0].method, 'signedLower');
    });

    it('@NO_BASELINE returns info for a transaction that is too historic to process', async () => {
      if (parseInt(await api.query.getCurrentBlock()) > SCHEDULE_PERIOD * 3 + 1000) {
        const blockNumber = '1';
        const transactionIndex = '0';
        let inclusionData = await api.query.getSummaryInclusionData(blockNumber, transactionIndex);
        assert.equal(inclusionData.status, 'For historic data please contact Aventus');
      }
    });


    it('@NO_BASELINE returns info for a transaction that does not exist', async () => {
      let currentBlock = parseInt(await api.query.getCurrentBlock());
      if (currentBlock > SCHEDULE_PERIOD * 3 + 1000) {
        const blockNumber = currentBlock - SCHEDULE_PERIOD;
        const transactionIndex = '10000';
        let inclusionData = await api.query.getSummaryInclusionData(blockNumber, transactionIndex);
        assert.equal(inclusionData.status, 'Transaction not found');
      }
    });

    it('@NO_BASELINE returns info for an as yet unpublished transaction', async () => {
      const amount = new BN(1);
      const requestId = await api.send.transferAvt(relayer.address, recipient.address, amount);
      let response = await helper.confirmStatus(api, requestId, 'Processed');
      let inclusionData = await api.query.getSummaryInclusionData(response.blockNumber, response.transactionIndex);
      assert.equal(inclusionData.status, 'Not yet published');
    });
  });

  describe('getNonce', async () => {
    it('@NO_BASELINE returns the same token nonce by address as by public key', async () => {
      const nonce = await api.query.getNonce(user.address, 'token');
      assert.equal(nonce, await api.query.getNonce(user.publicKey, 'token'));
    });

    it('@NO_BASELINE returns the same payment nonce by address as by public key', async () => {
      const nonce = await api.query.getNonce(user.address, 'payment');
      assert.equal(nonce, await api.query.getNonce(user.publicKey, 'payment'));
    });

    it('@NO_BASELINE returns the same staking nonce by address as by public key', async () => {
      const nonce = await api.query.getNonce(user.address, 'staking');
      assert.equal(nonce, await api.query.getNonce(user.publicKey, 'staking'));
    });

    it('@NO_BASELINE returns the same confirmation nonce by address as by public key', async () => {
      const nonce = await api.query.getNonce(user.address, 'confirmation');
      assert.equal(nonce, await api.query.getNonce(user.publicKey, 'confirmation'));
    });
  });

  describe('getRelayerFees', async () => {
    it('@NO_BASELINE returns default fees for a relayer by address', async () => {
      const returnedFees = await api.query.getRelayerFees(relayer.address);
      assert.equal(JSON.stringify(returnedFees), JSON.stringify(expectedRelayerFees));
    });

    it('@NO_BASELINE returns default fees for a relayer by publicKey', async () => {
      const returnedFees = await api.query.getRelayerFees(relayer.publicKey);
      assert.equal(JSON.stringify(returnedFees), JSON.stringify(expectedRelayerFees));
    });

    it('@NO_BASELINE returns fees for a specific user by address', async () => {
      const returnedFees = await api.query.getRelayerFees(relayer.address, user.address);
      assert.equal(JSON.stringify(returnedFees), JSON.stringify(expectedUserFees));
    });

    it('@NO_BASELINE returns fees for a specific user by publicKey', async () => {
      const returnedFees = await api.query.getRelayerFees(relayer.publicKey, user.publicKey);
      assert.equal(JSON.stringify(returnedFees), JSON.stringify(expectedUserFees));
    });

    it('@NO_BASELINE returns the fee for a specific user and transaction type', async () => {
      const transactionType = 'proxyTokenTransfer';
      const returnedFees = await api.query.getRelayerFees(relayer.address, user.publicKey, transactionType);
      assert.equal(returnedFees, expectedUserFees[transactionType]);
    });

    it('@NO_BASELINE errors if relayer is not registered', async () => {
      await expect(api.query.getRelayerFees(user)).to.be.rejectedWith(Error);
    });
  });

  describe('getAvtBalance', async () => {
    //getAvtBalance(account)
    it('@NO_BASELINE returns correct avt balance for specific user by address', async () => {
      assert.fail("actual", "expected", "Error message");
    });
    it('@NO_BASELINE returns correct avt balance for specific user by publicKey', async () => {
      assert.fail("actual", "expected", "Error message");
    });
  });
  describe('getTokenBalance', async () => {
    //getTokenBalance(account, token_address)
    it('@NO_BASELINE returns correct token balance for specific user by address', async () => {
      assert.fail("actual", "expected", "Error message");
    });
    it('@NO_BASELINE returns correct token balance for specific user by publicKey', async () => {
      assert.fail("actual", "expected", "Error message");
    });
  });
  describe('getNonce', async () => {
    //getAccountNonce(account)
    it('@NO_BASELINE returns correct account nonce for specific user by address', async () => {
      assert.fail("actual", "expected", "Error message");
    });
    it('@NO_BASELINE returns correct account nonce for specific user by publicKey', async () => {
      assert.fail("actual", "expected", "Error message");
    });
  });
  describe('getNftNonce', async () => {
    //getNftNonce(nftId)
    it('@NO_BASELINE returns correct nft nonce for specific nft id', async () => {
      assert.fail("actual", "expected", "Error message");
    });
  });
  describe('getNftId', async () => {
    //getNftId(external_reference);
    it('@NO_BASELINE returns correct nft id for specific reference', async () => {
      assert.fail("actual", "expected", "Error message");
    });
  });
  describe('getNftOwner', async () => {
    //getNftOwner(nftId)
    it('@NO_BASELINE returns correct nft owner for specific nft id', async () => {
      assert.fail("actual", "expected", "Error message");
    });
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

    it('@NO_BASELINE returns the correct list of owned nft ids', async () => {
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

    it('@NO_BASELINE returns the correct data', async () => {
      const returnedData = await api.query.getStakingStats();
      // We can't be sure how about the values but we can check the structure
      const totalStakedBN = new BN(returnedData.totalStaked);
      const averageStakedBN = new BN(returnedData.averageStaked);
      const minimumStakedBN = new BN(returnedData.minimumStaked);
      const minUserBondBN = new BN(returnedData.minUserBond);
      const maxNominatorsRewardedPerValidatorBN = new BN(returnedData.maxNominatorsRewardedPerValidator);
      const totalStakersBN = new BN(returnedData.totalStakers);

      assert(totalStakedBN.gte(BN_ZERO), 'Total stake is zero');
      assert(averageStakedBN.gte(BN_ZERO), 'Average stake is zero');
      assert(averageStakedBN.lte(totalStakedBN), 'Average stake must be less than total stake');
      assert(totalStakersBN.gte(BN_ZERO), 'Total number of stakers is zero');
      assert(minimumStakedBN.lte(averageStakedBN), 'Minimum stake must be less than or equal to average stake');
      assert(minUserBondBN.gt(BN_ZERO), 'Minimum user bond does not match default value');
      assert(
        maxNominatorsRewardedPerValidatorBN.eq(defaultMaxNominatorsRewardedPerValidatorBN),
        "Maximum number of nominators doesn't match default value"
      );
    });
  });

  describe('getEraElectionStatus', async () => {
    it('@NO_BASELINE returns the correct data', async () => {
      const returnedData = await api.query.getEraElectionStatus();
      // We can't be sure about the values but we can check the structure
      assert(['isOpen', 'isClosed'].includes(returnedData), 'Election status is not a valid result');
    });
  });
});
