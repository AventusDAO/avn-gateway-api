const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');
const avn = require('./avn');
const rds = require('./db/index');
const redis = require('./redis');
const crypto = require('crypto');
const lambda = require('./lambdas');
const util = require('util');
const config = require('multiconfig').load();
const setTimeoutPromise = util.promisify(setTimeout);
const log = require('log4js').configure(config.log4Js).getLogger();
const sqsClient = new SQSClient({ region: config.aws.region });

const TRIGGER_TX_STATUS_UPDATE_DELAY_MS = 45000;
const WEBHOOKS_REFRESH_INTERVAL_MS = 20000;
const PUBLISH_EVENT_RETRY_DELAY_MS = 1000;
const MAX_PUBLISH_EVENT_RETRIES = 3;

// Initializes the permitted event types and any active webhooks
// Webhooks are kept up-to-date via frequent DB resyncs that run in the background
class Webhooks {
  constructor(refreshInterval) {
    this.refreshInterval = refreshInterval;
  }

  static async init(refreshInterval) {
    const instance = new Webhooks(refreshInterval);
    await instance.initialize();
    return instance;
  }

  async initialize() {
    try {
      [this.eventTypes, this.active, this.webhooksState, this.eventTypesState] = await Promise.all([
        rds.getWebhookEventTypes(),
        rds.getActiveWebhooks(),
        rds.getWebhooksState(),
        rds.getWebhookEventTypesState()
      ]);
      this.scheduleNextRefresh();
    } catch (error) {
      log.error('[Webhooks] Initialization error:', error);
    }
  }

  async refresh() {
    try {
      const [eventTypesState, webhooksState] = await Promise.all([rds.getWebhookEventTypesState(), rds.getWebhooksState()]);

      if (this.eventTypesState !== eventTypesState) {
        this.eventTypesState = eventTypesState;
        this.eventTypes = await rds.getWebhookEventTypes();
        log.info(`[Webhooks] Refreshed event types - ${Object.keys(this.eventTypes).length} event types`);
      }

      if (this.webhooksState !== webhooksState) {
        this.webhooksState = webhooksState;
        this.active = await rds.getActiveWebhooks();
        log.info(`[Webhooks] Refreshed webhooks - ${Object.keys(this.active).length} webhooks`);
      }
    } catch (error) {
      log.error('[Webhooks] Error - Failed to refresh webhooks:', error);
    } finally {
      this.scheduleNextRefresh();
    }
  }

  scheduleNextRefresh() {
    setTimeout(() => this.refresh(), this.refreshInterval);
  }
}

let webhooks;

async function init() {
  webhooks = await Webhooks.init(WEBHOOKS_REFRESH_INTERVAL_MS);
  log.info(`[Webhooks] Init - ${Object.keys(webhooks.active).length} hooks ${Object.keys(webhooks.eventTypes).length} types`);
}

async function publishTransactionEvents(transactions) {
  for (const tx of transactions) {
    try {
      const { requestId, accountId } = await redis.getSentTxDetails(tx.transactionHash);
      if (!requestId) continue;

      const eventType = tx.status === 'Processed' ? 'tx_succeeded' : tx.status === 'Rejected' ? 'tx_execution_failed' : null;
      if (!eventType) continue;

      await publishEvent({ eventType, requestId, accountId, data: tx });
      redis.deleteSentTxDetails(tx.transactionHash);
    } catch (error) {
      log.error('[Webhooks] Error - Error publishing transaction events', error);
    }
  }
}

async function publishEvent(event) {
  let attempt = 0;

  while (attempt < MAX_PUBLISH_EVENT_RETRIES) {
    try {
      await attemptToPublishEvent(event);
      return;
    } catch (error) {
      attempt++;
      log.error(`[Webhooks] Error - Attempt ${attempt}: Error publishing event`, error);
      if (attempt >= MAX_PUBLISH_EVENT_RETRIES) {
        log.error('[Webhooks] Error - Maximum retry attempts reached. Event not published.', error);
        return;
      }
      await setTimeoutPromise(PUBLISH_EVENT_RETRY_DELAY_MS);
    }
  }
}

async function attemptToPublishEvent(event) {
  const { eventType, publicKey, requestId, data } = checkEvent(event);
  if (!webhooks.active.hasOwnProperty(publicKey)) return;

  const { endpoint, eventTypes } = webhooks.active[publicKey];
  if (!eventTypes.hasOwnProperty(eventType)) return;

  if (eventType === 'tx_sent') {
    await redis.setSentTxDetails(data.transactionHash, { requestId, accountId: publicKey });
    setTimeout(() => {
      lambda.resolvePendingTransactionsState().catch(error => {
        log.error('[Webhooks] Error - Failed to trigger tx status update', error);
      });
    }, TRIGGER_TX_STATUS_UPDATE_DELAY_MS);
  }

  const eventData = { timestamp: Date.now(), event: eventTypes[eventType], publicKey, requestId, data };
  await sendToQueue(JSON.stringify({ endpoint, eventData }), publicKey);
}

function checkEvent(event) {
  const { eventType, accountId, requestId, data } = event;
  const missingParams = Object.entries(event)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missingParams.length > 0) {
    throw new Error(`[Webhooks] Internal Error - Missing event params: ${missingParams.join(', ')}`);
  }

  if (!webhooks.eventTypes[eventType]) {
    throw new Error(`[Webhooks] Internal Error - Invalid event type: ${eventType}`);
  }

  try {
    const publicKey = rds.getPublicKey(accountId);
    return { eventType, requestId, publicKey, data };
  } catch (error) {
    throw new Error(`[Webhooks] Internal Error - Invalid accountId: ${accountId} - ${error}`);
  }
}

async function sendToQueue(message, messageGroup) {
  const params = {
    QueueUrl: config.webhooks.queue_url,
    MessageBody: message,
    MessageGroupId: messageGroup,
    MessageDeduplicationId: hash(message)
  };

  await sqsClient.send(new SendMessageCommand(params));
}

function hash(message) {
  return crypto.createHash('sha256').update(message).digest('hex');
}

module.exports = {
  init,
  publishEvent,
  publishTransactionEvents
};
