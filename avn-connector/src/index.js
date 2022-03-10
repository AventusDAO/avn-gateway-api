'use strict';
const config = require('multiconfig').load();
const avn = require('./avn');
const redis = require('./redis');
const gatewayDb = require('./gatewayDb');
const mqConsumer = require('./mqConsumer');
const txStatusPoller = require('./txStatusPoller');
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
    txStatusPoller.resolvePendingTransactionsState();

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
    const result = await gatewayDb.getFees(req.body.relayer, req.body.user, req.body.transactionType);
    res.send(result);
  } catch (err) {
    next(err);
  }
});

app.post('/avnAccountInfo', async (req, res, next) => {
  try {
    log.trace({ avnQueryRequest: req.body });
    const result = await avn.accountInfo(req.body.accountId);
    res.send(result);
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
  await avn.init();
  await redis.connect();
  await mqConsumer.connectToMQ();
  await gatewayDb.init();
}

(async () => {
  await instantiateConnector();
})();
