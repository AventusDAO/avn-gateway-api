'use strict';
const config = require('multiconfig').load();
const avn = require('./avn');
const rds = require('./db/index');
const lowering = require('./lowering');
const loweringV2 = require('./lowers/loweringV2');
const redis = require('./redis');
const mqConsumer = require('./mqConsumer');
const lambda = require('./lambdas');
const express = require('express');
const log4js = require('log4js');
const jsonLayout = require('log4js-json-layout');

log4js.addLayout('json', jsonLayout);
log4js.configure(config.log4Js);
const log = log4js.getLogger();

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
    log.trace({ avnQueryRequest: req.body });
    const result = await avn.query(req.body.palletName, req.body.storageName, req.body.params);
    res.send(result);
  } catch (err) {
    next(err);
  }
});

app.post('/avnPoll', async (req, res, next) => {
  try {
    log.trace({ avnPollRequest: req.body });
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
    log.trace('pendingTransactions invoked');
    const result = await redis.getNextTransactionsToCheck();
    res.send(result);
  } catch (err) {
    next(err);
  }
});

app.post('/resolvePendingTransactions', async (req, res, next) => {
  try {
    log.trace({ resolvePendingTransactions: Object.keys(req.body) });
    const result = await redis.resolvePendingAvnTransactions(req.body.transactions);
    res.send(result);
  } catch (err) {
    next(err);
  }
});

app.post('/relayerFees', async (req, res, next) => {
  try {
    log.trace({ relayerFeesRequest: req.body });
    const result = await rds.getFees(req.body.relayer, req.body.user, req.body.transactionType);
    res.send(result);
  } catch (err) {
    next(err);
  }
});

app.post('/avnAccountInfo', async (req, res, next) => {
  try {
    log.trace({ avnAccountInfoRequest: req.body });
    const result = await avn.getAccountInfo(req.body.accountId);
    res.send(result);
  } catch (err) {
    next(err);
  }
});

app.post('/avnValidatorsToNominate', async (req, res, next) => {
  try {
    log.trace({ avnValidatorsToNominateRequest: req.body });
    const result = await avn.getCollatorsToNominate();
    res.send(JSON.stringify(result));
  } catch (err) {
    next(err);
  }
});

app.post('/avnStakingStats', async (req, res, next) => {
  try {
    log.trace({ avnStakingStatsRequest: req.body });
    const result = await avn.getStakingStats();
    res.send(JSON.stringify(result));
  } catch (err) {
    next(err);
  }
});

app.post('/avnChainInfo', async (req, res, next) => {
  try {
    log.trace({ avnChainInfoRequest: req.body });
    const result = await avn.getChainInfo();
    res.send(JSON.stringify(result));
  } catch (err) {
    next(err);
  }
});

app.post('/avnCurrentBlock', async (req, res, next) => {
  try {
    log.trace({ avnCurrentBlockRequest: req.body });
    const result = await avn.getCurrentBlock();
    res.send(result);
  } catch (err) {
    next(err);
  }
});

app.post('/getDefaultRelayer', async (req, res, next) => {
  try {
    log.trace({ defaultRelayerRequest: req.body });
    const result = avn.RELAYER_ADDRESS;
    res.send(result);
  } catch (err) {
    next(err);
  }
});

app.get('/unprocessedLifts', async (req, res, next) => {
  try {
    log.trace('unprocessedLifts invoked');
    const result = await avn.getUnprocessedLifts();
    res.send(result);
  } catch (err) {
    next(err);
  }
});

app.get('/autolower', async (req, res, next) => {
  try {
    log.trace('autolower invoked');
    const result = await loweringV2.autolower();
    res.send(result);
  } catch (err) {
    next(err);
  }
});

app.post('/ethereumEventStatus', async (req, res, next) => {
  try {
    log.trace({ ethereumEventStatusRequest: req.body });
    const result = await avn.ethereumEventStatus(req.body.ethTransactionHash);
    res.send(result);
  } catch (err) {
    next(err);
  }
});

app.post('/avnTotalToken', async (req, res, next) => {
  try {
    log.trace({ avnTotalTokenRequest: req.body });
    const result = await avn.getTotalToken(req.body.token);
    res.send({ total: result });
  } catch (err) {
    next(err);
  }
});

app.post('/avnNftContractAddresses', async (req, res, next) => {
  try {
    log.trace({ avnNftContractAddresses: req.body });
    const result = await avn.getNftContractAddresses();
    res.send(result);
  } catch (err) {
    next(err);
  }
});

app.post('/lowers', async (req, res, next) => {
  try {
    log.trace({ lowerDataRequest: req.body });
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
    log.trace({ gatewayUserInfo: req.body });
    const result = await avn.getGatewayUserInfo(req.body.account);
    res.send(result);
  } catch (err) {
    next(err);
  }
});

app.post('/getPayer', async (req, res, next) => {
  try {
    log.trace({ getPayer: JSON.stringify(req.body) });
    let result = await rds.getPayer(req.body.user, req.body.payer);
    result = !!result && (await avn.payerHasFunds(result.payerAddress)) ? result : undefined;
    res.send(result);
  } catch (err) {
    next(err);
  }
});

app.post('/isPayerTransaction', async (req, res, next) => {
  try {
    log.trace({ isPayerTransaction: JSON.stringify(req.body) });
    const result = await rds.isPayerTransaction(req.body.payer, req.body.transaction);
    res.send(result);
  } catch (err) {
    next(err);
  }
});

app.post('/addNewTransactionStatus', async (req, res, next) => {
  try {
    log.trace({ addNewTransactionStatus: JSON.stringify(req.body) });
    await avn.addNewTransaction(req.body.requestId);
    res.status(200).send({});
  } catch (err) {
    next(err);
  }
});

app.post('/setTransactionRefusedByPayerStatus', async (req, res, next) => {
  try {
    log.trace({ setTransactionRefusedByPayerStatus: JSON.stringify(req.body) });
    await avn.setSendingFailedStatus(req.body.requestId, redis.transactionStatus.PayerRefused);
    res.status(200).send({});
  } catch (err) {
    next(err);
  }
});

app.post('/setTransactionFailedToBeSentStatus', async (req, res, next) => {
  try {
    log.trace({ setTransactionFailedToBeSentStatus: JSON.stringify(req.body) });
    await avn.setSendingFailedStatus(req.body.requestId, redis.transactionStatus.SendingFailed);
    res.status(200).send({});
  } catch (err) {
    next(err);
  }
});

app.use(function (err, req, res, _next) {
  log.error(`Error processing request: ${JSON.stringify(req.body, null, 2)}`, `Stack: ${err.stack}`);
  res.status(500).send({ error: err.message });
});

app.listen(port, () => {
  log.info(`AvN connector listening on port ${port}`);
});

async function instantiateConnector() {
  await redis.connect();
  await avn.init();
  await mqConsumer.connectToMQ();
  await rds.init();
  loweringV2.getLowers('0x0'); // populates redis with up-to-date lower data upon initialisation
}

(async () => {
  await instantiateConnector();
})();
