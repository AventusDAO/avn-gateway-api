import { DataSource, IsNull, Repository } from 'typeorm';
import { isHex, u8aToHex } from '@polkadot/util';
import { decodeAddress, encodeAddress } from '@polkadot/util-crypto';
import crypto from 'crypto';
import { Payer } from './entity/payer';
import { SplitFeeUser } from './entity/splitFeeUser';
import { Transaction } from './entity/transaction';
import { PayerTransaction } from './entity/payerTransaction';
import { Fee } from './entity/fee';
import { Relayer } from './entity/relayer';
import { WebhookEndpoint } from './entity/webhookEndpoint';
import { WebhookEvent } from './entity/webhookEvent';
import { Webhooks } from './entity/webhooks';
import { PayerInfo } from '../types';
import { DefaultRelayerFee } from './entity/defaultRelayerFee';
import { Currency } from './entity/currency';
import { multiCurrency31726749398507 } from './migrations/1726749398507-multi-currency-3';
import { multiCurrency21726747887371 } from './migrations/1726747887371-multi-currency-2';

const config = require('multiconfig').load();

let dataSource: DataSource;

async function init(): Promise<DataSource> {
  dataSource = new DataSource({
    type: 'postgres',
    host: config.postgres.host,
    port: config.postgres.port,
    username: config.postgres.username,
    password: config.postgres.password,
    database: config.postgres.database,
    synchronize: false,
    entities: [
      Payer,
      SplitFeeUser,
      Transaction,
      PayerTransaction,
      Fee,
      Relayer,
      WebhookEndpoint,
      WebhookEvent,
      Webhooks,
      Currency,
      DefaultRelayerFee
    ],
    migrations: [
      multiCurrency21726747887371,
      multiCurrency31726749398507
    ],
    migrationsRun: config.postgres.synchronize === 'true',
  });

  await dataSource.initialize();


  console.log("Native token: ", config.nativeTokenAddress);
  return dataSource;
}

async function getPayer(
  user: string,
  payer?: string
): Promise<PayerInfo | null> {
  const userPublicKey = getPublicKey(user);

  if (!userPublicKey && !payer) return null;

  const userDataSource = await dataSource.getRepository(SplitFeeUser);

  const splitFeeUser = await userDataSource.findOne({
    where: { publicKey: userPublicKey, enabled: true },
    relations: ['payer']
  });
  if (!splitFeeUser || !splitFeeUser.payer) return null;

  if (payer) {
    const payerPublicKey = getPublicKey(payer);
    if (splitFeeUser.payer.publicKey !== payerPublicKey) {
      return null;
    }
  }

  return {
    payerId: splitFeeUser.payer.id,
    payerAddress: encodeAddress(splitFeeUser.payer.publicKey, 42),
    vaultId: splitFeeUser.payer.vaultId
  };
}

async function getFees(
  relayerAddress: string,
  currencyToken: string,
  user?: string,
  transactionName?: string
): Promise<Record<string, string> | string> {
  let userPk: string | undefined;

  const relayer = await getRelayer(relayerAddress);
  if (!relayer) throw new Error(`Relayer (${relayerAddress}) cannot be found.`);
  if (!getRelayerDetaultFee(relayer, currencyToken))
    throw new Error(
      `Relayer ${relayerAddress} does not support currency token: ${currencyToken}`
    );

  const feeDataSource = await dataSource.getRepository(Fee);

  if (user) {
    userPk = getPublicKey(user);
  }

  if (transactionName) {
    return await getSingleFee(
      feeDataSource,
      relayer,
      currencyToken,
      userPk,
      transactionName
    );
  }

  return await getAllFees(feeDataSource, relayer, currencyToken, userPk);
}

async function isPayerTransaction(
  payer: string,
  transactionName: string,
  currencyToken: string
): Promise<boolean> {
  if (!payer || !transactionName) return false;
  const payerPk = getPublicKey(payer);

  const payerTransactionDataSource =
    await dataSource.getRepository(PayerTransaction);

  const payerTx = await payerTransactionDataSource.findOne({
    where: {
      payer: { publicKey: payerPk, enabled: true },
      transaction: { name: transactionName, enabled: true },
      currency: { token: currencyToken, enabled: true },
      enabled: true
    },
    relations: ['payer', 'transaction', 'currency']
  });

  return payerTx ? true : false;
}

async function relayerAcceptsCurrency(
  relayerAddress: string,
  currencyToken: string
): Promise<boolean> {
  const relayer = await getRelayer(relayerAddress);
  if (!relayer) throw new Error(`Relayer (${relayerAddress}) cannot be found.`);
  if (!currencyToken) throw new Error(`Currency not specified`);

  const defaultRelayerFee = getRelayerDetaultFee(relayer, currencyToken);
  if (defaultRelayerFee) {
    return true;
  }

  return false;
}

async function getRelayer(relayerAddress: string): Promise<Relayer | null> {
  // Define a type for relayer if available
  if (!relayerAddress) return null;

  const relayerPk = getPublicKey(relayerAddress);
  const relayerDataSource = await dataSource.getRepository(Relayer);
  return await relayerDataSource.findOne({
    where: { publicKey: relayerPk, enabled: true }
  });
}

function buildFeesJson(
  feeDbResult: Fee[],
  relayerDefaultFee: string,
  transactionTypes: Transaction[]
): Record<string, string> {
  let defaultFee: string | null = null;
  const relayerFees: Record<string, string> = {};

  (feeDbResult || []).forEach(r => {
    const hasTransactionFee = !!r.transaction && !!r.transaction.name;
    if (hasTransactionFee) {
      if (!relayerFees[r.transaction!.name] || r.userPublicKey) {
        relayerFees[r.transaction!.name] = r.fee;
      }
    } else if (r.userPublicKey) {
      // We set a default fee for all transactions under this user
      // Except for the ones we have explicitly set
      defaultFee = r.fee;
    }
  });

  defaultFee = defaultFee ?? relayerDefaultFee;
  transactionTypes.forEach(
    tx => (relayerFees[tx.name] = relayerFees[tx.name] ?? defaultFee)
  );

  return relayerFees;
}

async function getTransactions(): Promise<Transaction[]> {
  // Define a type for transactions if available
  const transactionDataSource = await dataSource.getRepository(Transaction);

  return await transactionDataSource.find({
    where: {
      enabled: true
    }
  });
}

async function getSingleFee(
  feeDataSource: Repository<Fee>,
  relayer: Relayer,
  currencyToken: string,
  userPk: string | undefined,
  transactionName: string
): Promise<string> {
  const feeRow = await feeDataSource.findOne({
    where: {
      relayerId: relayer.id,
      currency: { token: currencyToken, enabled: true },
      userPublicKey: userPk || IsNull(),
      enabled: true,
      transaction: { name: transactionName, enabled: true }
    }
  });

  if (feeRow) {
    return feeRow.fee;
  } else {
    const defaultRelayerFee = getRelayerDetaultFee(relayer, currencyToken);
    if (!defaultRelayerFee)
      throw new Error(
        `Relayer ${relayer.id} does not accept currency: ${currencyToken}`
      );

    return defaultRelayerFee.fee;
  }
}

async function getAllFees(
  feeDataSource: Repository<Fee>,
  relayer: Relayer,
  currencyToken: string,
  userPk: string | undefined
): Promise<Record<string, string>> {
  const fees = await feeDataSource.find({
    where: {
      relayerId: relayer.id,
      userPublicKey: userPk || IsNull(),
      currency: { token: currencyToken, enabled: true },
      enabled: true
    }
  });

  const defaultRelayerFee = getRelayerDetaultFee(relayer, currencyToken);
  if (!fees && !defaultRelayerFee) {
    throw new Error(
      `Relayer ${relayer.id} does not accept currency: ${currencyToken}`
    );
  }

  const transactionTypes = await getTransactions();
  return buildFeesJson(fees, defaultRelayerFee!.fee, transactionTypes);
}

function getRelayerDetaultFee(
  relayer: Relayer,
  currencyToken: string
): DefaultRelayerFee | undefined {
  return relayer.defaultFees.find(f => f.currency.token === currencyToken);
}

async function getRelayerVaultId(relayerAddress: string): Promise<string> {
  if (!relayerAddress)
    throw new Error(`Invalid relayer address ${relayerAddress}`);

  const relayer = await getRelayer(relayerAddress);
  if (!relayer) throw new Error(`Relayer (${relayerAddress}) cannot be found.`);

  return relayer.vaultId;
}

function getPublicKey(account: string): string {
  if (!account) throw new Error(`Address is NULL`);
  if (isHex(account) && account.length != 66)
    throw new Error(`Invalid hex encoded address ${account}`);

  try {
    return u8aToHex(decodeAddress(account));
  } catch (err: any) {
    throw new Error(`Invalid address ${account}: ${err.toString()}`);
  }
}

async function getActiveWebhooks(): Promise<Record<string, any>> {
  // Define a proper type for the return value if available
  try {
    const webhooks = await dataSource
      .getRepository(Payer)
      .createQueryBuilder('p')
      .select('p.publicKey', 'publicKey')
      .addSelect('we.endpoint', 'endpoint')
      .leftJoin('p.webhookEndpoint', 'we')
      .leftJoin('we.webhooks', 'w')
      .leftJoin('w.webhookEvent', 'wev')
      .addSelect('wev.type', 'eventType')
      .addSelect('wev.description', 'eventDescription')
      .where('p.enabled = :enabled', { enabled: true })
      .andWhere('we.enabled = :webhookEndpointEnabled', {
        webhookEndpointEnabled: true
      })
      .andWhere('wev.enabled = :webhookEventEnabled', {
        webhookEventEnabled: true
      })
      .andWhere('p.webhookEndpointId IS NOT NULL')
      .getRawMany();

    return webhooks.reduce(
      (active, { publicKey, endpoint, eventType, eventDescription }) => {
        if (!active[publicKey])
          active[publicKey] = { endpoint, eventTypes: {} };
        active[publicKey].eventTypes[eventType] = eventDescription;
        return active;
      },
      {}
    );
  } catch (error: any) {
    throw new Error(`Failed to get active webhooks: ${error.message}`);
  }
}

async function getWebhookEventTypes(): Promise<Record<string, string>> {
  try {
    const webhookEventDataSource = await dataSource.getRepository(WebhookEvent);
    return (await webhookEventDataSource.find()).reduce(
      (
        webhookEvents: { [type: string]: string },
        { type, description }: WebhookEvent
      ) => {
        webhookEvents[type] = description;
        return webhookEvents;
      },
      {}
    );
  } catch (error: any) {
    throw new Error(`Failed to get webhook event types: ${error.message}`);
  }
}

async function getWebhookEventTypesState(): Promise<string> {
  const stats = await dataSource
    .getRepository(WebhookEvent)
    .createQueryBuilder('event')
    .select('COUNT(event.id)', 'count')
    .addSelect('MAX(event.updatedAt)', 'lastUpdate')
    .getRawOne();

  return crypto
    .createHash('sha256')
    .update(JSON.stringify(stats))
    .digest('hex');
}

async function getWebhooksState(): Promise<string> {
  const stats = await Promise.all([
    dataSource
      .getRepository(Payer)
      .createQueryBuilder('payer')
      .select('COUNT(payer.id)', 'payerCount')
      .addSelect('MAX(payer.updatedAt)', 'payerLastUpdate')
      .getRawOne(),
    dataSource
      .getRepository(WebhookEndpoint)
      .createQueryBuilder('endpoint')
      .select('COUNT(endpoint.id)', 'endpointCount')
      .addSelect('MAX(endpoint.updatedAt)', 'endpointLastUpdate')
      .getRawOne(),
    dataSource
      .getRepository(Webhooks)
      .createQueryBuilder('webhooks')
      .select('COUNT(webhooks.webhookEndpointId)', 'webhooksCount')
      .getRawOne()
  ]);

  return crypto
    .createHash('sha256')
    .update(JSON.stringify(stats))
    .digest('hex');
}

const rds = {
  getPayer,
  getFees,
  getPublicKey,
  getRelayerVaultId,
  init,
  isPayerTransaction,
  getActiveWebhooks,
  getWebhookEventTypes,
  getWebhookEventTypesState,
  getWebhooksState,
  relayerAcceptsCurrency
};
export default rds;
