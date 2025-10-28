'use strict';
const config = require('multiconfig').load();
import avn from './avn';
import rds from './db/index';
import loweringV2 from './lowers/loweringV2';
import autolowering from './lowers/autolowering';
import redis, { TransactionStatus } from './redis';
import { processTxQueue } from './sqsConsumer';
import webhooks from './webhooks';
import lambda from './lambdas';
import express, { Express, Request, Response, NextFunction } from 'express';
import logger from './logger';
import {
  PollResult,
  TxNotFoundResult,
  PollErrorResult,
  AccountInfo,
  AccountInfoNonStaking,
  UnprocessedLifts,
  EthereumEventStatus,
  NftInfo,
  BatchInfo,
  GatewayUserInfo,
  PayerInfo,
  SuccessResponse,
  TotalToken,
  LowerData
} from './types';
import { ChainSummary } from './redis/types';

const VOW_MODE = config.vowMode === 'true';

const app: Express = express();
const port: number = config.serverPort;

app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: '50mb' }));

app.get(
  '/health',
  async (req: Request, res: Response<null>, next: NextFunction) => {
    try {
      res.status(200).send(null);
    } catch (err) {
      next(err);
    }
  }
);

app.post(
  '/avnQuery',
  async (req: Request, res: Response<string>, next: NextFunction) => {
    try {
      logger.info({ avnQueryRequest: JSON.stringify(req.body) });

      let result;

      if (VOW_MODE && req.body.palletName in ['parachainStaking']) {
        result = '';
      } else {
        result = await avn.query(
          req.body.palletName,
          req.body.storageName,
          req.body.params
        );
      }

      res.status(200).send(result);
    } catch (err) {
      next(err);
    }
  }
);

app.post(
  '/avnPoll',
  async (
    req: Request,
    res: Response<PollResult | TxNotFoundResult | PollErrorResult>,
    next: NextFunction
  ) => {
    try {
      logger.info({ avnPollRequest: JSON.stringify(req.body) });
      // the await is removed on purpose here
      lambda.resolvePendingTransactionsState();
      const result = await avn.poll(req.body.requestId);
      res.status(200).send(result);
    } catch (err) {
      next(err);
    }
  }
);

app.get(
  '/pendingTransactions',
  async (req: Request, res: Response<string[]>, next: NextFunction) => {
    try {
      logger.info('pendingTransactions invoked');
      const result = await redis.getNextTransactionsToCheck();
      res.status(200).send(result);
    } catch (err) {
      next(err);
    }
  }
);

app.post(
  '/resolvePendingTransactions',
  async (req: Request, res: Response<null>, next: NextFunction) => {
    try {
      logger.info({ resolvePendingTransactions: Object.keys(req.body) });
      const transactions = req.body.transactions;
      webhooks.publishTransactionEvents(transactions);
      await redis.resolvePendingAvnTransactions(transactions);
      res.status(200).send(null);
    } catch (err) {
      next(err);
    }
  }
);

app.post(
  '/relayerFees',
  async (
    req: Request,
    res: Response<string | Record<string, string>>,
    next: NextFunction
  ) => {
    try {
      logger.info({ relayerFeesRequest: JSON.stringify(req.body) });
      const result = await rds.getFees(
        req.body.relayer,
        req.body.currencyToken,
        req.body.user,
        req.body.transactionType
      );
      res.status(200).send(result);
    } catch (err) {
      next(err);
    }
  }
);

app.post(
  '/avnAccountInfo',
  async (
    req: Request,
    res: Response<AccountInfo | AccountInfoNonStaking>,
    next: NextFunction
  ) => {
    try {
      logger.info({ avnAccountInfoRequest: JSON.stringify(req.body) });
      const result = await avn.getAccountInfo(req.body.accountId);
      res.status(200).send(result);
    } catch (err) {
      next(err);
    }
  }
);

app.post(
  '/avnValidatorsToNominate',
  async (req: Request, res: Response<string>, next: NextFunction) => {
    try {
      logger.info({ avnValidatorsToNominateRequest: JSON.stringify(req.body) });
      const result = await avn.getCollatorsToNominate();
      res.status(200).send(JSON.stringify(result));
    } catch (err) {
      next(err);
    }
  }
);

app.post(
  '/avnStakingStats',
  async (req: Request, res: Response<string>, next: NextFunction) => {
    try {
      logger.info({ avnStakingStatsRequest: JSON.stringify(req.body) });
      const result = await avn.getStakingStats();
      res.status(200).send(JSON.stringify(result));
    } catch (err) {
      next(err);
    }
  }
);

app.post(
  '/avnChainInfo',
  async (req: Request, res: Response<string>, next: NextFunction) => {
    try {
      logger.info({ avnChainInfoRequest: JSON.stringify(req.body) });
      const result = await avn.getChainInfo();
      res.status(200).send(JSON.stringify(result));
    } catch (err) {
      next(err);
    }
  }
);

app.post(
  '/avnCurrentBlock',
  async (req: Request, res: Response<string>, next: NextFunction) => {
    try {
      logger.info({ avnCurrentBlockRequest: JSON.stringify(req.body) });
      const result = await avn.getCurrentBlock();
      res.status(200).send(result);
    } catch (err) {
      next(err);
    }
  }
);

app.post(
  '/getDefaultRelayer',
  async (req: Request, res: Response<string>, next: NextFunction) => {
    try {
      logger.info({ defaultRelayerRequest: JSON.stringify(req.body) });
      const result = avn.RELAYER_ADDRESS;
      res.status(200).send(result);
    } catch (err) {
      next(err);
    }
  }
);

app.get(
  '/unprocessedLifts',
  async (req: Request, res: Response<UnprocessedLifts>, next: NextFunction) => {
    try {
      logger.info('unprocessedLifts invoked');
      const result = await avn.getUnprocessedLifts();
      res.status(200).send(result);
    } catch (err) {
      next(err);
    }
  }
);

app.get(
  '/autolower',
  async (req: Request, res: Response<string>, next: NextFunction) => {
    try {
      logger.info('autolower invoked');
      const result = await autolowering.autolower();
      logger.info(result);
      res.status(200).send(result);
    } catch (err) {
      next(err);
    }
  }
);

app.post(
  '/ethereumEventStatus',
  async (
    req: Request,
    res: Response<EthereumEventStatus>,
    next: NextFunction
  ) => {
    try {
      logger.info({ ethereumEventStatusRequest: JSON.stringify(req.body) });
      const result = await avn.ethereumEventStatus(req.body.ethTransactionHash);
      res.status(200).send(result);
    } catch (err) {
      next(err);
    }
  }
);

app.post(
  '/avnTotalToken',
  async (req: Request, res: Response<TotalToken>, next: NextFunction) => {
    try {
      logger.info({ avnTotalTokenRequest: JSON.stringify(req.body) });
      const result = await avn.getTotalToken(req.body.token);
      res.status(200).send({ total: result });
    } catch (err) {
      next(err);
    }
  }
);

app.post(
  '/avnNftContractAddresses',
  async (req: Request, res: Response<string>, next: NextFunction) => {
    try {
      logger.info({ avnNftContractAddresses: JSON.stringify(req.body) });
      const result = await avn.getNftContractAddresses();
      res.status(200).send(result);
    } catch (err) {
      next(err);
    }
  }
);

app.post(
  '/getNftInfo',
  async (req: Request, res: Response<NftInfo | null>, next: NextFunction) => {
    try {
      logger.info({ getNftInfo: JSON.stringify(req.body) });
      const result = await avn.getNftInfo(req.body.nftId);
      res.status(200).send(result);
    } catch (err) {
      next(err);
    }
  }
);

app.post(
  '/getBatchInfo',
  async (req: Request, res: Response<BatchInfo | null>, next: NextFunction) => {
    try {
      logger.info({ getBatchInfo: JSON.stringify(req.body) });
      const result = await avn.getBatchInfo(req.body.batchId);
      res.status(200).send(result);
    } catch (err) {
      next(err);
    }
  }
);

app.post(
  '/lowers',
  async (req: Request, res: Response<LowerData | null>, next: NextFunction) => {
    try {
      logger.info({ lowerDataRequest: JSON.stringify(req.body) });
      const result = await loweringV2.getLowers(req.body.account);
      res.status(200).send(result);
    } catch (err) {
      next(err);
    }
  }
);

app.post(
  '/gatewayUserInfo',
  async (req: Request, res: Response<GatewayUserInfo>, next: NextFunction) => {
    try {
      logger.info({ gatewayUserInfo: JSON.stringify(req.body) });
      const result = await avn.getGatewayUserInfo(req.body.account);
      res.status(200).send(result);
    } catch (err) {
      next(err);
    }
  }
);

app.post(
  '/getPayer',
  async (req: Request, res: Response<PayerInfo | null>, next: NextFunction) => {
    try {
      logger.info({ getPayer: JSON.stringify(req.body) });
      let result = await rds.getPayer(req.body.user, req.body.payer);
      result =
        !!result && (await avn.payerHasFunds(result.payerAddress))
          ? result
          : null;
      res.status(200).send(result);
    } catch (err) {
      next(err);
    }
  }
);

app.post(
  '/isPayerTransaction',
  async (req: Request, res: Response<boolean>, next: NextFunction) => {
    try {
      logger.info({ isPayerTransaction: JSON.stringify(req.body) });
      const result = await rds.isPayerTransaction(
        req.body.payer,
        req.body.transaction,
        req.body.currencyToken
      );
      res.status(200).send(result);
    } catch (err) {
      next(err);
    }
  }
);

app.post(
  '/addNewTransactionStatus',
  async (req: Request, res: Response<null>, next: NextFunction) => {
    try {
      logger.info({ addNewTransactionStatus: JSON.stringify(req.body) });
      await avn.addNewTransaction(req.body.requestId);
      res.status(200).send(null);
    } catch (err) {
      next(err);
    }
  }
);

app.post(
  '/canCallMethod',
  async (req: Request, res: Response<Boolean>, next: NextFunction) => {
    try {
      logger.info({ pallet: JSON.stringify(req.body.palletName), extrinsic: JSON.stringify(req.body.method) });
      let result = avn.canCallMethod(req.body.palletName, req.body.method);
      res.status(200).send(result);
    } catch (err) {
      next(err);
    }
  }
);

app.post(
  '/setTransactionRefusedByPayerStatus',
  async (req: Request, res: Response<null>, next: NextFunction) => {
    try {
      logger.info({
        setTransactionRefusedByPayerStatus: JSON.stringify(req.body)
      });
      await avn.setSendingFailedStatus(
        req.body.requestId,
        TransactionStatus.PayerRefused
      );
      res.status(200).send(null);
    } catch (err) {
      next(err);
    }
  }
);

app.post(
  '/setTransactionFailedToBeSentStatus',
  async (req: Request, res: Response<null>, next: NextFunction) => {
    try {
      logger.info({
        setTransactionFailedToBeSentStatus: JSON.stringify(req.body)
      });
      await avn.setSendingFailedStatus(
        req.body.requestId,
        TransactionStatus.SendingFailed
      );
      res.status(200).send(null);
    } catch (err) {
      next(err);
    }
  }
);

app.post(
  '/publishEvent',
  async (req: Request, res: Response<null>, next: NextFunction) => {
    try {
      logger.info({ publishEventRequest: JSON.stringify(req.body) });
      webhooks.publishEvent(req.body);
      res.status(200).send(null);
    } catch (err) {
      next(err);
    }
  }
);

app.post(
  '/relayerAcceptsCurrency',
  async (req: Request, res: Response<boolean>, next: NextFunction) => {
    try {
      logger.info({ relayerAcceptsCurrency: JSON.stringify(req.body) });
      const result = await rds.relayerAcceptsCurrency(
        req.body.relayerAddress,
        req.body.currencyToken
      );
      res.status(200).send(result);
    } catch (err) {
      next(err);
    }
  }
);

app.post(
  '/nativeCurrencyToken',
  async (req: Request, res: Response<string>, next: NextFunction) => {
    try {
      logger.info({ nativeCurrencyToken: JSON.stringify(req.body) });
      const result = await rds.getNativeCurrencyToken();
      res.status(200).send(JSON.stringify(result));
    } catch (err) {
      next(err);
    }
  }
);

app.post(
  '/supportedCurrencies',
  async (req: Request, res: Response<string>, next: NextFunction) => {
    try {
      logger.info({ supportedCurrencies: JSON.stringify(req.body) });
      const result = await rds.getSupportedCurrencies();
      res.status(200).send(JSON.stringify(result));
    } catch (err) {
      next(err);
    }
  }
);

app.get(
  '/getLastSubmittedSummary',
  async (req: Request, res: Response<ChainSummary | { message: string; error?: string }>, next: NextFunction) => {
    try {
      logger.info({ getLastSubmittedSummary: JSON.stringify(req.query) });

      const validation = avn.validateGetSummaryRequest(req.query.chainId);
      if (!validation.isValid && validation.error) {
        return res.status(validation.error.status).json({ message: validation.error.message });
      }

      const chainId = req.query.chainId as string;

      const summary = await redis.getLastSubmittedSummary(chainId);

      if (!summary) {
        return res.status(404).send({
          message: 'Summary not found',
          chainId
        });
      }

      return res.status(200).send(summary);



    } catch (error) {
      next(error);
      return undefined; // typescript quirk
    }
  }
);

app.post(
  '/setLastSubmittedSummary',
  async (req: Request, res: Response<ChainSummary | { message: string; error?: string }>, next: NextFunction) => {
    try {
      logger.info({ setLastSubmittedSummary: JSON.stringify(req.body) });

      const validation = avn.validateSetSummaryRequest(req.body);
      if (!validation.isValid && validation.error) {
        return res.status(validation.error.status).json({ message: validation.error.message });
      }

      const { chainId, rootId, rootHash } = req.body;
      const summary: ChainSummary = { chainId, rootId, rootHash };

      await redis.setLastSubmittedSummary(chainId, summary);
      return res.status(200).send(summary);

    } catch (error) {
      next(error);
      return undefined; // typescript quirk
    }
  }
);

app.post(
  '/getPredictionMarketConstants',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      logger.info({ getPredictionMarketConstants: JSON.stringify(req.body) });
      const result = await avn.predictionMarketConstants();
      res.status(200).send(JSON.stringify(result));
    } catch (error) {
      next(error);
    }
  }
);

app.post(
  '/getNodeManagerConfig',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      logger.info({ getNodeManagerConfig: JSON.stringify(req.body) });
      const result = await avn.nodeManagerConfig();
      res.status(200).send(JSON.stringify(result));
    } catch (error) {
      next(error);
    }
  }
);

app.post(
  '/getNodeManagerInfo',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      logger.info({ getNodeManagerInfo: JSON.stringify(req.body) });
      const result = await avn.nodeManagerInfo();
      res.status(200).send(JSON.stringify(result));
    } catch (error) {
      next(error);
    }
  }
);

app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  logger.error(
    `Error processing request: ${err.message}. Request: ${JSON.stringify(req.body)}`,
    `Stack: ${err.stack}`
  );
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
