'use strict';
const config = require('multiconfig').load();
import avn from './avn';
import rds from './db/index';
import loweringV2 from './lowers/loweringV2';
import autolowering from './lowers/autolowering';
import redis, {transactionStatus} from './redis';
import { processTxQueue } from './sqsConsumer';
import webhooks from './webhooks';
import lambda from './lambdas';
import express, { Express, Request, Response, NextFunction } from 'express';
import logger from './logger';

const app: Express = express();
const port: number = config.serverPort;

app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: '50mb' }));

app.get('/health', async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.send({});
  } catch (err) {
    next(err);
  }
});

app.post('/avnQuery', async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info({ avnQueryRequest: req.body });
    const result = await avn.query(req.body.palletName, req.body.storageName, req.body.params);
    res.send(result);
  } catch (err) {
    next(err);
  }
});

app.post('/avnPoll', async (req: Request, res: Response, next: NextFunction) => {
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

app.get('/pendingTransactions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info('pendingTransactions invoked');
    const result = await redis.getNextTransactionsToCheck();
    res.send(result);
  } catch (err) {
    next(err);
  }
});

app.post('/resolvePendingTransactions', async (req: Request, res: Response, next: NextFunction) => {
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

app.post('/relayerFees', async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info({ relayerFeesRequest: req.body });
    const result = await rds.getFees(req.body.relayer, req.body.user, req.body.transactionType);
    res.send(result);
  } catch (err) {
    next(err);
  }
});

app.post('/avnAccountInfo', async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info({ avnAccountInfoRequest: req.body });
    const result = await avn.getAccountInfo(req.body.accountId);
    res.send(result);
  } catch (err) {
    next(err);
  }
});

app.post('/avnValidatorsToNominate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info({ avnValidatorsToNominateRequest: req.body });
    const result = await avn.getCollatorsToNominate();
    res.send(JSON.stringify(result));
  } catch (err) {
    next(err);
  }
});

app.post('/avnStakingStats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info({ avnStakingStatsRequest: req.body });
    const result = await avn.getStakingStats();
    res.send(JSON.stringify(result));
  } catch (err) {
    next(err);
  }
});

app.post('/avnChainInfo', async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info({ avnChainInfoRequest: req.body });
    const result = await avn.getChainInfo();
    res.send(JSON.stringify(result));
  } catch (err) {
    next(err);
  }
});

app.post('/avnCurrentBlock', async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info({ avnCurrentBlockRequest: req.body });
    const result = await avn.getCurrentBlock();
    res.send(result);
  } catch (err) {
    next(err);
  }
});

app.post('/getDefaultRelayer', async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info({ defaultRelayerRequest: req.body });
    const result = avn.RELAYER_ADDRESS;
    res.send(result);
  } catch (err) {
    next(err);
  }
});

app.get('/unprocessedLifts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info('unprocessedLifts invoked');
    const result = await avn.getUnprocessedLifts();
    res.send(result);
  } catch (err) {
    next(err);
  }
});

app.get('/autolower', async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info('autolower invoked');
    const result = await autolowering.autolower();
    logger.info(result);
    res.send(result);
  } catch (err) {
    next(err);
  }
});

app.post('/ethereumEventStatus', async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info({ ethereumEventStatusRequest: req.body });
    const result = await avn.ethereumEventStatus(req.body.ethTransactionHash);
    res.send(result);
  } catch (err) {
    next(err);
  }
});

app.post('/avnTotalToken', async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info({ avnTotalTokenRequest: req.body });
    const result = await avn.getTotalToken(req.body.token);
    res.send({ total: result });
  } catch (err) {
    next(err);
  }
});

app.post('/avnNftContractAddresses', async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info({ avnNftContractAddresses: req.body });
    const result = await avn.getNftContractAddresses();
    res.send(result);
  } catch (err) {
    next(err);
  }
});

app.post('/getNftInfo', async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info({ getNftInfo: req.body });
    const result = await avn.getNftInfo(req.body.nftId);
    res.send(result);
  } catch (err) {
    next(err);
  }
});

app.post('/getBatchInfo', async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info({ getBatchInfo: req.body });
    const result = await avn.getBatchInfo(req.body.batchId);
    res.send(result);
  } catch (err) {
    next(err);
  }
});

app.post('/lowers', async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info({ lowerDataRequest: req.body });
    const result = await loweringV2.getLowers(req.body.account);
    res.send(result);
  } catch (err) {
    next(err);
  }
});

app.post('/gatewayUserInfo', async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info({ gatewayUserInfo: req.body });
    const result = await avn.getGatewayUserInfo(req.body.account);
    res.send(result);
  } catch (err) {
    next(err);
  }
});

app.post('/getPayer', async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info({ getPayer: JSON.stringify(req.body) });
    let result = await rds.getPayer(req.body.user, req.body.payer);
    result = !!result && (await avn.payerHasFunds(result.payerAddress)) ? result : undefined;
    res.send(result);
  } catch (err) {
    next(err);
  }
});

app.post('/isPayerTransaction', async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info({ isPayerTransaction: JSON.stringify(req.body) });
    const result = await rds.isPayerTransaction(req.body.payer, req.body.transaction);
    res.send(result);
  } catch (err) {
    next(err);
  }
});

app.post('/addNewTransactionStatus', async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info({ addNewTransactionStatus: JSON.stringify(req.body) });
    await avn.addNewTransaction(req.body.requestId);
    res.status(200).send({});
  } catch (err) {
    next(err);
  }
});

app.post('/setTransactionRefusedByPayerStatus', async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info({ setTransactionRefusedByPayerStatus: JSON.stringify(req.body) });
    await avn.setSendingFailedStatus(req.body.requestId, transactionStatus.PayerRefused);
    res.status(200).send({});
  } catch (err) {
    next(err);
  }
});

app.post('/setTransactionFailedToBeSentStatus', async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info({ setTransactionFailedToBeSentStatus: JSON.stringify(req.body) });
    await avn.setSendingFailedStatus(req.body.requestId, transactionStatus.SendingFailed);
    res.status(200).send({});
  } catch (err) {
    next(err);
  }
});

app.post('/publishEvent', async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info({ publishEventRequest: req.body });
    webhooks.publishEvent(req.body);
    res.status(200).send({});
  } catch (err) {
    next(err);
  }
});

app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
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
  processTxQueue(); // triggers infinite loop - don't await
  loweringV2.getLowers('0x0'); // populates redis with up-to-date lower data upon initialisation
}

(async () => {
  await instantiateConnector();
})();
