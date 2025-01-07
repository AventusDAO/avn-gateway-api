const assert = require('chai').assert;
const { SetupMode, SigningMode } = require('avn-api');
const helper = require('./helper.js');

const BN = helper.BN;
const accounts = helper.ACCOUNTS;

async function getBlockRange(api) {
  const currentBlock = await api.query.getCurrentBlock();
  return { Block: [currentBlock, currentBlock + 2000] }
}

async function waitForEndBlock(api, finalBlock) {
  let currentBlock = await api.query.getCurrentBlock();
  let blocksLeft = finalBlock - currentBlock;
  while( blocksLeft > 0 ) {
    await helper.sleep(blocksLeft * 6000);
    currentBlock = await api.query.getCurrentBlock();
    blocksLeft = finalBlock - currentBlock;
  }
}

describe('Prediction Market tests', async () => {
  let api, otherUserApi, blockRange;
  let user = accounts.user;
  let otherUser = accounts.otherUser;
  let token = "0xbfaffd8001493dfeb51c26748d2aff53c2984190";
  const buyAmount = "10000000000";

  let marketId = 11;
  let winningChoice = 1;
  let losingChoice = 0;

  before(async () => {
    const signer = {
      sign: async (data, signerAddress) => {
        return await helper.remoteSigner(data, signerAddress);
      }
    };

    const options = {
      signer: signer,
      setupMode: SetupMode.MultiUser,
      signingMode: SigningMode.RemoteSigner
    };

    avnGateway = await helper.avnApi(options);
    api = await avnGateway.apis(user.address);
    otherUserApi = await avnGateway.apis(otherUser.address);
  });

  describe('Create market and deploy pool', function () {
    let requestId;
    before(async () => {
      blockRange = await getBlockRange(api);
      const amount = 10000000000000;
      const spotPrices = [5000000000, 5000000000];

      requestId = await api.send.createMarketAndDeployPool(
        token,
        user.address,
        blockRange,
        { grace_period: 10, oracle_duration: 1000, dispute_duration: 0 },
        { Sha3_384: '0x1530111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111110' },
        amount,
        spotPrices,
      );
    });

    describe('succeeds if', async function () {
      it('Request is processed', async function () {
        await helper.confirmStatus(api.poll, requestId, 'Processed');
      });
      it('Market is active', async function () {
        const marketInfo = await api.query.getMarketInfo(marketId);
        assert.equal(marketInfo.status, 'Active');
      });
    });
  });

  describe('Transfer PM tokens', function () {
    let requestId;
    before(async () => {
      requestId = await api.send.transferMarketToken(token, otherUser.address, buyAmount);
    });

    describe('succeeds if', function () {
      it('Request is processed', async function () {
        await helper.confirmStatus(api.poll, requestId, 'Processed');
      });
      xit('PM Balance if updated correctly', function () {});
    });
  });

  describe('Buy tokens via hybrid router', function () {
    let requestId, requestId2;
    before(async () => {
      requestId = await api.send.buyMarketOutcomeTokens(marketId, winningChoice, buyAmount, "7500000000");
      requestId2 = await otherUserApi.send.buyMarketOutcomeTokens(marketId, losingChoice, buyAmount, "7500000000");
    });

    describe('succeeds if', function () {
      it('Requests are processed', async function () {
        await helper.confirmStatus(api.poll, requestId, 'Processed');
        await helper.confirmStatus(otherUserApi.poll, requestId2, 'Processed');
      });
      xit('Winning token is correctly bought', function () {});
      xit('Losing token is correctly bought', function () {});
    });
  });

  describe('Report', function () {
    let requestId;
    before(async () => {
      await waitForEndBlock(api, blockRange.Block[1]);
      requestId = await api.send.reportMarketOutcome(marketId, winningChoice);
    });

    describe('succeeds if', function () {
      it('Request is processed', async function () {
        await helper.confirmStatus(api.poll, requestId, 'Processed');
      });
      it('Market report is updated correctly', async function () {
        const marketInfo = await api.query.getMarketInfo(marketId);
        assert.equal(JSON.stringify(marketInfo.report.outcome), JSON.stringify({categorical: winningChoice}));
      });
    });
  });

  describe('redeemShares', function () {
    let requestId, requestId2;
    before(async () => {
      requestId = await api.send.redeemMarketShares(marketId);
      requestId2 = await otherUserApi.send.redeemMarketShares(marketId);
    });

    describe('succeeds if', function () {
      it('Requests are processed', async function () {
        await helper.confirmStatus(api.poll, requestId, 'Processed');
        await helper.confirmStatus(otherUserApi.poll, requestId2, 'Processed');
      });

      it('Rewards are collected for winning user', function () {});
      it('Rewards are zero for losing user', function () {});
    });
  });

  describe('withdraw tokens', function () {
    let requestId, balanceBeforeWithdraw;
    let floor = "100000000";
    let withdrawAmount = "1000000000";

    before(async () => {
      balanceBeforeWithdraw = new BN(await api.query.getTokenBalance(user.address, token));
      requestId = await api.send.withdrawMarketTokens(token, withdrawAmount);
    });

    describe('succeeds if', function () {
      it('Request is processed', async function () {
        await helper.confirmStatus(api.poll, requestId, 'Processed');
      });

      it('Tokens are withdrawn', async function () {
        let balanceAfterWithdraw = new BN(await api.query.getTokenBalance(user.address, token));
        let flooredWithdrawAmount = balanceBeforeWithdraw.div(new BN(floor));
        assert.equal(balanceBeforeWithdraw.toString(), balanceAfterWithdraw.add(new BN(flooredWithdrawAmount)).toString());
      });
    });
  });
});
