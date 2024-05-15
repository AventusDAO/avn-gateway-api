'use strict';
const config = require('multiconfig').load();
const avn = require('./avn');
const rds = require('./db/index');
const lowering = require('./lowering');
const loweringV2 = require('./lowers/loweringV2');
const autolowering = require('./lowers/autolowering');
const redis = require('./redis');
const sqsConsumer = require('./sqsConsumer');
const webhooks = require('./webhooks');
const lambda = require('./lambdas');
const express = require('express');
const { logger} = require('./logger');
const app = express();
const port = config.serverPort;

app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: '50mb' }));

app.get('/health', async (req, res, next) => {
  try {
    res.send({});
  } catch (err) {
    next(err);
  }
});

app.post('/avnQuery', async (req, res, next) => {
  try {
    logger.info({ avnQueryRequest: req.body });
    const result = await avn.query(req.body.palletName, req.body.storageName, req.body.params);
    res.send(result);
  } catch (err) {
    next(err);
  }
});

app.post('/avnPoll', async (req, res, next) => {
  try {
    logger.info({ avnPollRequest: req.body });
    // the await is removed on purpose here
    lambda.resolvePendingTransactionsState();

    const result = await avn.poll(req.body.requestId);
    res.send(result);
  } catch (err) {
    next(err);
  }
});

app.get('/pendingTransactions', async (req, res, next) => {
  try {
    logger.info('pendingTransactions invoked');
    const result = await redis.getNextTransactionsToCheck();
    res.send(result);
  } catch (err) {
    next(err);
  }
});

app.post('/resolvePendingTransactions', async (req, res, next) => {
  try {
    logger.info({ resolvePendingTransactions: Object.keys(req.body) });
    const transactions = req.body.transactions;
    webhooks.publishTransactionEvents(transactions);
    const result = await redis.resolvePendingAvnTransactions(transactions);
    res.send(result);
  } catch (err) {
    next(err);
  }
});

app.post('/relayerFees', async (req, res, next) => {
  try {
    logger.info({ relayerFeesRequest: req.body });
    const result = await rds.getFees(req.body.relayer, req.body.user, req.body.transactionType);
    res.send(result);
  } catch (err) {
    next(err);
  }
});

app.post('/avnAccountInfo', async (req, res, next) => {
  try {
    logger.info({ avnAccountInfoRequest: req.body });
    const result = await avn.getAccountInfo(req.body.accountId);
    res.send(result);
  } catch (err) {
    next(err);
  }
});

app.post('/avnValidatorsToNominate', async (req, res, next) => {
  try {
    logger.info({ avnValidatorsToNominateRequest: req.body });
    const result = await avn.getCollatorsToNominate();
    res.send(JSON.stringify(result));
  } catch (err) {
    next(err);
  }
});

app.post('/avnStakingStats', async (req, res, next) => {
  try {
    logger.info({ avnStakingStatsRequest: req.body });
    const result = await avn.getStakingStats();
    res.send(JSON.stringify(result));
  } catch (err) {
    next(err);
  }
});

app.post('/avnChainInfo', async (req, res, next) => {
  try {
    logger.info({ avnChainInfoRequest: req.body });
    const result = await avn.getChainInfo();
    res.send(JSON.stringify(result));
  } catch (err) {
    next(err);
  }
});

app.post('/avnCurrentBlock', async (req, res, next) => {
  try {
    logger.info({ avnCurrentBlockRequest: req.body });
    const result = await avn.getCurrentBlock();
    res.send(result);
  } catch (err) {
    next(err);
  }
});

app.post('/getDefaultRelayer', async (req, res, next) => {
  try {
    logger.info({ defaultRelayerRequest: req.body });
    const result = avn.RELAYER_ADDRESS;
    res.send(result);
  } catch (err) {
    next(err);
  }
});

app.get('/unprocessedLifts', async (req, res, next) => {
  try {
    logger.info('unprocessedLifts invoked');
    const result = await avn.getUnprocessedLifts();
    res.send(result);
  } catch (err) {
    next(err);
  }
});

app.get('/autolower', async (req, res, next) => {
  try {
    logger.info('autolower invoked');
    const result = await autolowering.autolower();
    logger.info(result);
    res.send(result);
  } catch (err) {
    next(err);
  }
});

app.post('/ethereumEventStatus', async (req, res, next) => {
  try {
    logger.info({ ethereumEventStatusRequest: req.body });
    const result = await avn.ethereumEventStatus(req.body.ethTransactionHash);
    res.send(result);
  } catch (err) {
    next(err);
  }
});

app.post('/avnTotalToken', async (req, res, next) => {
  try {
    logger.info({ avnTotalTokenRequest: req.body });
    const result = await avn.getTotalToken(req.body.token);
    res.send({ total: result });
  } catch (err) {
    next(err);
  }
});

app.post('/avnNftContractAddresses', async (req, res, next) => {
  try {
    logger.info({ avnNftContractAddresses: req.body });
    const result = await avn.getNftContractAddresses();
    res.send(result);
  } catch (err) {
    next(err);
  }
});

app.post('/getNftInfo', async (req, res, next) => {
  try {
    logger.info({ getNftInfo: req.body });
    const result = await avn.getNftInfo(req.body.nftId);
    res.send(result);
  } catch (err) {
    next(err);
  }
});

app.post('/getBatchInfo', async (req, res, next) => {
  try {
    logger.info({ getBatchInfo: req.body });
    const result = await avn.getBatchInfo(req.body.batchId);
    res.send(result);
  } catch (err) {
    next(err);
  }
});

app.post('/lowers', async (req, res, next) => {
  try {
    logger.info({ lowerDataRequest: req.body });
    let oldLowers;

    try {
      oldLowers = await lowering.getLowers(req.body.account);
    } catch (err) {
      console.log(`Error fetching legacy lowers`, err);
      oldLowers = [];
    }

    let newLowers = await loweringV2.getLowers(req.body.account);
    res.send((oldLowers || []).concat(newLowers));
  } catch (err) {
    next(err);
  }
});

app.post('/gatewayUserInfo', async (req, res, next) => {
  try {
    logger.info({ gatewayUserInfo: req.body });
    const result = await avn.getGatewayUserInfo(req.body.account);
    res.send(result);
  } catch (err) {
    next(err);
  }
});

app.post('/getPayer', async (req, res, next) => {
  try {
    logger.info({ getPayer: JSON.stringify(req.body) });
    let result = await rds.getPayer(req.body.user, req.body.payer);
    result = !!result && (await avn.payerHasFunds(result.payerAddress)) ? result : undefined;
    res.send(result);
  } catch (err) {
    next(err);
  }
});

app.post('/isPayerTransaction', async (req, res, next) => {
  try {
    logger.info({ isPayerTransaction: JSON.stringify(req.body) });
    const result = await rds.isPayerTransaction(req.body.payer, req.body.transaction);
    res.send(result);
  } catch (err) {
    next(err);
  }
});

app.post('/addNewTransactionStatus', async (req, res, next) => {
  try {
    logger.info({ addNewTransactionStatus: JSON.stringify(req.body) });
    await avn.addNewTransaction(req.body.requestId);
    res.status(200).send({});
  } catch (err) {
    next(err);
  }
});

app.post('/setTransactionRefusedByPayerStatus', async (req, res, next) => {
  try {
    logger.info({ setTransactionRefusedByPayerStatus: JSON.stringify(req.body) });
    await avn.setSendingFailedStatus(req.body.requestId, redis.transactionStatus.PayerRefused);
    res.status(200).send({});
  } catch (err) {
    next(err);
  }
});

app.post('/setTransactionFailedToBeSentStatus', async (req, res, next) => {
  try {
    logger.info({ setTransactionFailedToBeSentStatus: JSON.stringify(req.body) });
    await avn.setSendingFailedStatus(req.body.requestId, redis.transactionStatus.SendingFailed);
    res.status(200).send({});
  } catch (err) {
    next(err);
  }
});

app.post('/publishEvent', async (req, res, next) => {
  try {
    logger.info({ publishEventRequest: req.body });
    webhooks.publishEvent(req.body);
    res.status(200).send({});
  } catch (err) {
    next(err);
  }
});

app.use(function (err, req, res, _next) {
  logger.error(`Error processing request: ${JSON.stringify(req.body, null, 2)}`, `Stack: ${err.stack}`);
  res.status(500).send({ error: err.message });
});

app.listen(port, () => {
  logger.info(`AvN connector listening on port ${port}`);
});

async function instantiateConnector() {
  await redis.connect();
  await avn.init();
  await rds.init();
  await webhooks.init();
  sqsConsumer.processTxQueue(); // triggers infinite loop - don't await
  loweringV2.getLowers('0x0'); // populates redis with up-to-date lower data upon initialisation
}

(async () => {
  await instantiateConnector();
})();
