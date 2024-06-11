import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import avn from './avn';
import rds from './db/index';
import redis from './redis';
import * as crypto from 'crypto';
import lambda from './lambdas';
import * as util from 'util';
const config = require('multiconfig').load();
import logger from './logger';

const setTimeoutPromise = util.promisify(setTimeout);
const sqsClient = new SQSClient({ region: config.aws.region });

const TRIGGER_TX_STATUS_UPDATE_DELAY_MS = 45000;
const WEBHOOKS_REFRESH_INTERVAL_MS = 20000;
const PUBLISH_EVENT_RETRY_DELAY_MS = 1000;
const MAX_PUBLISH_EVENT_RETRIES = 3;

const WEBHOOK_EVENT_TYPES = {
  tx_received: 'tx_received',
  tx_payer_accepted: 'tx_payer_accepted',
  tx_queued: 'tx_queued',
  tx_ready: 'tx_ready',
  tx_sent: 'tx_sent',
  tx_payer_refused: 'tx_payer_refused',
  tx_send_failed: 'tx_send_failed',
  tx_execution_failed: 'tx_execution_failed',
  tx_succeeded: 'tx_succeeded'
} as const;

type WebhookEventType = keyof typeof WEBHOOK_EVENT_TYPES;

interface Transaction {
  transactionHash: string;
  status: 'Processed' | 'Rejected';
}

interface Event {
  eventType: WebhookEventType;
  accountId: string;
  requestId: string;
  data: any;
}

// Initializes the permitted event types and any active webhooks
// Webhooks are kept up-to-date via frequent DB resyncs that run in the background
class Webhooks {
  eventTypes: Record<string, string>;
  active: Record<
    string,
    { endpoint: string; eventTypes: Record<string, string> }
  >;
  refreshInterval: number;
  eventTypesState: string | null;
  webhooksState: string | null;

  constructor(refreshInterval: number) {
    this.eventTypes = {};
    this.active = {};
    this.refreshInterval = refreshInterval;
    this.eventTypesState = null;
    this.webhooksState = null;
  }

  async initialize() {
    [this.eventTypes, this.active, this.webhooksState, this.eventTypesState] =
      await Promise.all([
        rds.getWebhookEventTypes(),
        rds.getActiveWebhooks(),
        rds.getWebhooksState(),
        rds.getWebhookEventTypesState()
      ]);
    this.scheduleNextRefresh();
  }

  async refresh() {
    try {
      const [eventTypesState, webhooksState] = await Promise.all([
        rds.getWebhookEventTypesState(),
        rds.getWebhooksState()
      ]);

      if (this.eventTypesState !== eventTypesState) {
        this.eventTypesState = eventTypesState;
        this.eventTypes = await rds.getWebhookEventTypes();
        logger.info(
          `[Webhooks] Refreshed event types - ${Object.keys(this.eventTypes).length} event types`
        );
      }

      if (this.webhooksState !== webhooksState) {
        this.webhooksState = webhooksState;
        this.active = await rds.getActiveWebhooks();
        logger.info(
          `[Webhooks] Refreshed webhooks - ${Object.keys(this.active).length} webhooks`
        );
      }
    } catch (error) {
      logger.error('[Webhooks] Error - Failed to refresh webhooks:', error);
    } finally {
      this.scheduleNextRefresh();
    }
  }

  scheduleNextRefresh() {
    setTimeout(() => this.refresh(), this.refreshInterval);
  }

  hasEventTypes(): boolean {
    return Object.keys(this.eventTypes).length > 0;
  }
}

let _webhooks: Webhooks;

async function init() {
  try {
    _webhooks = new Webhooks(WEBHOOKS_REFRESH_INTERVAL_MS);
    await _webhooks.initialize();
    confirmExpectedEventTypes();
    logger.info(
      `[Webhooks] Init - ${Object.keys(_webhooks.active).length} hooks ${Object.keys(_webhooks.eventTypes).length} types`
    );
  } catch (error) {
    logger.error('[Webhooks] Init error:', error);
    throw error;
  }
}

function confirmExpectedEventTypes() {
  if (!_webhooks.hasEventTypes()) {
    logger.info(
      '[Webhooks] Webhook Event table not populated - skipping expected types check'
    );
    return;
  }

  const dbTypes = Object.keys(_webhooks.eventTypes);
  const connectorTypes = Object.keys(WEBHOOK_EVENT_TYPES);
  const dbMissing = connectorTypes.filter(type => !dbTypes.includes(type));
  const connectorMissing = dbTypes.filter(
    type => !connectorTypes.includes(type)
  );

  if (dbMissing.length > 0 || connectorMissing.length > 0) {
    const errorParts = [];
    if (dbMissing.length > 0)
      errorParts.push(`DB missing types: ${dbMissing.join(', ')}`);
    if (connectorMissing.length > 0)
      errorParts.push(
        `Connector missing types: ${connectorMissing.join(', ')}`
      );
    throw new Error(`Event types mismatch: ${errorParts.join(' | ')}`);
  }
}

async function publishTransactionEvents(transactions: Transaction[]) {
  if (!_webhooks.hasEventTypes()) {
    return;
  }

  logger.info(`[Webhooks] Publishing transactions events`);
  for (const tx of transactions) {
    try {
      const { requestId, accountId } = await redis.getSentTxDetails(
        tx.transactionHash
      );
      if (!requestId) continue;

      let eventType: WebhookEventType | null = null;

      if (tx.status === 'Processed') {
        eventType = WEBHOOK_EVENT_TYPES.tx_succeeded;
      } else if (tx.status === 'Rejected') {
        eventType = WEBHOOK_EVENT_TYPES.tx_execution_failed;
      }

      if (!eventType) continue;

      await publishEvent({ eventType, requestId, accountId, data: tx });
      await redis.deleteSentTxDetails(tx.transactionHash);
    } catch (error) {
      logger.error(
        '[Webhooks] Error - Error publishing transaction events',
        error
      );
    }
  }
}

async function publishEvent(event: Event) {
  if (!_webhooks.hasEventTypes()) {
    return;
  }
  logger.info(`[Webhooks] Publishing event ${JSON.stringify(event)}`);
  let attempt = 0;

  while (attempt < MAX_PUBLISH_EVENT_RETRIES) {
    try {
      await attemptToPublishEvent(event);
      return;
    } catch (error) {
      attempt++;
      logger.error(
        `[Webhooks] Error - Attempt ${attempt}: Error publishing event`,
        error
      );
      if (attempt >= MAX_PUBLISH_EVENT_RETRIES) {
        logger.error(
          '[Webhooks] Error - Maximum retry attempts reached. Event not published.',
          error
        );
        return;
      }
      await setTimeoutPromise(PUBLISH_EVENT_RETRY_DELAY_MS);
    }
  }
}

async function attemptToPublishEvent(event: Event) {
  const { eventType, publicKey, requestId, data } = checkEvent(event);
  if (!_webhooks.active.hasOwnProperty(publicKey)) return;

  const { endpoint, eventTypes } = _webhooks.active[publicKey];
  if (!eventTypes.hasOwnProperty(eventType)) return;

  if (eventType === 'tx_sent') {
    await redis.setSentTxDetails(data.transactionHash, {
      requestId,
      accountId: publicKey
    });
    setTimeout(() => {
      lambda.resolvePendingTransactionsState().catch(error => {
        logger.error(
          '[Webhooks] Error - Failed to trigger tx status update',
          error
        );
      });
    }, TRIGGER_TX_STATUS_UPDATE_DELAY_MS);
  }

  const eventData = {
    timestamp: Date.now(),
    event: eventTypes[eventType],
    publicKey,
    requestId,
    data
  };
  await sendToQueue(JSON.stringify({ endpoint, eventData }), publicKey);
}

function checkEvent(event: Event) {
  const { eventType, accountId, requestId, data } = event;
  const missingParams = Object.entries(event)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missingParams.length > 0) {
    throw new Error(
      `[Webhooks] Internal Error - Missing event params: ${missingParams.join(', ')}`
    );
  }

  if (!_webhooks.eventTypes[eventType]) {
    throw new Error(
      `[Webhooks] Internal Error - Invalid event type: ${eventType}`
    );
  }

  try {
    const publicKey = rds.getPublicKey(accountId);
    return { eventType, requestId, publicKey, data };
  } catch (error) {
    throw new Error(
      `[Webhooks] Internal Error - Invalid accountId: ${accountId} - ${error}`
    );
  }
}

async function sendToQueue(message: string, messageGroup: string) {
  const params = {
    QueueUrl: config.webhooks.queue_url,
    MessageBody: message,
    MessageGroupId: messageGroup,
    MessageDeduplicationId: hash(message)
  };

  await sqsClient.send(new SendMessageCommand(params));
}

function hash(message: string): string {
  return crypto.createHash('sha256').update(message).digest('hex');
}

const webhooks = {
  init,
  publishEvent,
  publishTransactionEvents,
  WEBHOOK_EVENT_TYPES
};
export default webhooks;
