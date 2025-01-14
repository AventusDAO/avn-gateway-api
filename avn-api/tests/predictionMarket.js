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
  let api, otherUserApi, blockRange, winnerOutcomeTokens;
  let user = accounts.user;
  let otherUser = accounts.otherUser;
  let token = "0xbfaffd8001493dfeb51c26748d2aff53c2984190";
  const buyAmount = "10000000000";

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
      const amount = 1000000000000;
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
      marketId = (await api.query.getMarketCounter() - 1);
      console.log(`marketId: ${marketId}`);
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
    let requestId, senderBalanceBefore, receiverBalanceBefore, senderBalanceAfter, receiverBalanceAfter;
    before(async () => {
      senderBalanceBefore = (await api.query.getMarketTokenBalance(user.address, { ForeignAsset: 0 })).free;
      receiverBalanceBefore = (await api.query.getMarketTokenBalance(otherUser.address, { ForeignAsset: 0 })).free;

      requestId = await api.send.transferMarketToken(token, otherUser.address, buyAmount);

      senderBalanceAfter = (await api.query.getMarketTokenBalance(user.address, { ForeignAsset: 0 })).free;
      receiverBalanceAfter = (await api.query.getMarketTokenBalance(otherUser.address, { ForeignAsset: 0 })).free;
    });

    describe('succeeds if', function () {
      it('Request is processed', async function () {
        await helper.confirmStatus(api.poll, requestId, 'Processed');
      });
      it('PM Balance if updated correctly', function () {
        assert.equal(receiverBalanceBefore.add(new BN(buyAmount)).toString(), receiverBalanceAfter.toString());
        assert.equal(senderBalanceBefore.sub(new BN(buyAmount)).toString(), senderBalanceAfter.toString());
      });
    });
  });

  describe('Buy tokens via hybrid router', function () {
    let requestId, requestId2, winnerTokenBalanceBefore, winnerTokenBalanceAfter, loserTokenBalanceBefore, loserTokenBalanceAfter, loserOutcomeTokens;
    before(async () => {
      let poolInfo = await api.query.getMarketPoolInfo(marketId);
      let choiceReserve = getOutcomeReserve(poolInfo.reserves, marketId, winningChoice);
      winnerOutcomeTokens = await calculateSwapAmountOutForBuy(
        new Decimal(choiceReserve),
        new Decimal(buyAmount),
        new Decimal(poolInfo.liquidityParameter),
        new Decimal(0.03),
        new Decimal(0)
      );

      winnerTokenBalanceBefore = (await api.query.getMarketTokenBalance(user.address, { CategoricalOutcome: [marketId, winningChoice] })).free;
      loserTokenBalanceBefore = (await api.query.getMarketTokenBalance(user.address, { CategoricalOutcome: [marketId, winningChoice] })).free;

      requestId = await api.send.buyMarketOutcomeTokens(marketId, winningChoice, buyAmount, "7500000000");

      // Since pool is afected after the first buy we need to recalculate here
      poolInfo = (await avnManager.queryMarketPoolInfo(marketId)).toJSON();
      choiceReserve = getOutcomeReserve(poolInfo.reserves, marketId, losingChoice);
      loserOutcomeTokens = await calculateSwapAmountOutForBuy(
        new Decimal(choiceReserve),
        new Decimal(buyAmount),
        new Decimal(poolInfo.liquidityParameter),
        new Decimal(0.03),
        new Decimal(0)
      );

      requestId2 = await otherUserApi.send.buyMarketOutcomeTokens(marketId, losingChoice, buyAmount, "7500000000");

      winnerTokenBalanceAfter = (await api.query.getMarketTokenBalance(user.address, { CategoricalOutcome: [marketId, winningChoice] })).free;
      loserTokenBalanceAfter = (await api.query.getMarketTokenBalance(user.address, { CategoricalOutcome: [marketId, winningChoice] })).free;
    });

    describe('succeeds if', function () {
      it('Requests are processed', async function () {
        await helper.confirmStatus(api.poll, requestId, 'Processed');
        await helper.confirmStatus(otherUserApi.poll, requestId2, 'Processed');
      });
      it('Winning token is correctly bought', function () {
        assert.equal(winnerTokenBalanceBefore.add(new BN(winnerOutcomeTokens)).toString(), winnerTokenBalanceAfter.toString());
      });
      it('Losing token is correctly bought', function () {
        assert.equal(loserTokenBalanceBefore.add(new BN(loserOutcomeTokens)).toString(), loserTokenBalanceAfter.toString());
      });
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
    let requestId, requestId2, winnerBalanceBefore, winnerBalanceAfter, loserBalanceBefore, loserBalanceAfter;
    before(async () => {
      winnerBalanceBefore = (await api.query.getMarketTokenBalance(user.address, { ForeignAsset: 0 })).free;
      loserBalanceBefore = (await api.query.getMarketTokenBalance(otherUser.address, { ForeignAsset: 0 })).free;

      requestId = await api.send.redeemMarketShares(marketId);
      requestId2 = await otherUserApi.send.redeemMarketShares(marketId);

      winnerBalanceAfter = (await api.query.getMarketTokenBalance(user.address, { ForeignAsset: 0 })).free;
      loserBalanceAfter = (await api.query.getMarketTokenBalance(otherUser.address, { ForeignAsset: 0 })).free;
    });

    describe('succeeds if', function () {
      it('Requests are processed', async function () {
        await helper.confirmStatus(api.poll, requestId, 'Processed');
        await helper.confirmStatus(otherUserApi.poll, requestId2, 'Processed');
      });

      it('Rewards are collected for winning user', function () {
        assert.equal(winnerBalanceBefore.add(new BN(winnerOutcomeTokens)).toString(), winnerBalanceAfter.toString());
      });
      it('Rewards are zero for losing user', function () {
        assert.equal(loserBalanceBefore.toString(), loserBalanceAfter.toString());
      });
    });
  });

  describe('withdraw tokens', function () {
    let requestId, tokenBalanceBeforeWithdraw, ForeignAssetBalanceBefore, ForeignAssetBalanceAfter, tokenBalanceAfterWithdraw;
    let floor = "100000000";
    let withdrawAmount = "1000000000";

    before(async () => {
      ForeignAssetBalanceBefore = (await api.query.getMarketTokenBalance(user.address, { ForeignAsset: 0 })).free;
      tokenBalanceBeforeWithdraw = new BN(await api.query.getTokenBalance(user.address, token));

      requestId = await api.send.withdrawMarketTokens(token, withdrawAmount);

      ForeignAssetBalanceAfter = (await api.query.getMarketTokenBalance(user.address, { ForeignAsset: 0 })).free;
      tokenBalanceAfterWithdraw = new BN(await api.query.getTokenBalance(user.address, token));
    });

    describe('succeeds if', function () {
      it('Request is processed', async function () {
        await helper.confirmStatus(api.poll, requestId, 'Processed');
      });

      it('Tokens are withdrawn', async function () {
        let flooredWithdrawAmount = tokenBalanceBeforeWithdraw.div(new BN(floor));
        assert.equal(tokenBalanceBeforeWithdraw.add(new BN(flooredWithdrawAmount)).toString(), tokenBalanceAfterWithdraw.toString());
        assert.equal(ForeignAssetBalanceBefore.toString(), ForeignAssetBalanceAfter.add(new BN(withdrawAmount)).toString());
      });
    });
  });
});

function getOutcomeReserve(reserves, marketId, choice) {
  return reserves[`{"categoricalOutcome":[${marketId},${choice}]}`];
}

// buy outcome token with the base asset
// 0.01 for 1% on poolFee and creatorFee
async function calculateSwapAmountOutForBuy(reserve, amountIn, liquidity, poolFee, creatorFee) {
  // remove the fees before executing the buy
  const totalFee = poolFee.plus(creatorFee);
  const feeMultiplier = new Decimal(1).minus(totalFee);
  const amountInMinusFees = amountIn.mul(feeMultiplier);

  const exp1 = amountInMinusFees.div(liquidity).exp();
  const exp2 = new Decimal(0).minus(reserve.div(liquidity)).exp();

  return Math.round(exp1
    .minus(new Decimal(1))
    .plus(exp2)
    .ln()
    .mul(liquidity)
    .plus(reserve)
    .minus(amountIn)
    .plus(amountIn).toNumber());
};

// sell outcome token for the base asset
async function calculateSwapAmountOutForSell(reserve, amountIn, liquidity, poolFee, creatorFee) {
  const exp1 = amountIn.plus(reserve).div(liquidity).exp();
  const exp2 = amountIn.div(liquidity).exp();

  const amountOut = exp1
    .minus(exp2)
    .plus(1)
    .ln()
    .mul(liquidity)
    .mul(-1)
    .plus(reserve)
    .plus(amountIn);

  // remove the fees after executing the sell
  const totalFee = poolFee.plus(creatorFee);
  const feeMultiplier = new Decimal(1).minus(totalFee);
  return amountOut.mul(feeMultiplier);
};