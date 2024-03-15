const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');
const avn = require('./avn');
const rds = require('./db/index');
const redis = require('./redis');
const crypto = require('crypto');
const config = require('multiconfig').load();
const log = require('log4js').configure(config.log4Js).getLogger();
const sqsClient = new SQSClient({ region: config.aws.region });

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
    [this.eventTypes, this.active, this.counts, this.updated] = await Promise.all([
      rds.getWebhookEventTypes(),
      rds.getActiveWebhooks(),
      this.getCounts(),
      this.getLastUpdated()
    ]);
    this.refreshWebhooks();
  }

  async getCounts() {
    return Promise.all([rds.getWebhooksCount(), rds.getWebhookEndpointCount()]).then(([webhooks, endpoint]) => ({
      webhooks,
      endpoint
    }));
  }

  async getLastUpdated() {
    return Promise.all([rds.getWebhooksLastUpdated(), rds.getWebhookEndpointLastUpdated()]).then(([webhooks, endpoint]) => ({
      webhooks,
      endpoint
    }));
  }

  async refreshWebhooks() {
    try {
      const [counts, updated] = await Promise.all([this.getCounts(), this.getLastUpdated()]);
      const entriesAddedOrRemoved = JSON.stringify(this.counts) !== JSON.stringify(counts);
      const entriesUpdated = JSON.stringify(this.updated) !== JSON.stringify(updated);

      if (entriesAddedOrRemoved || entriesUpdated) {
        this.counts = counts;
        this.updated = updated;
        this.active = await rds.getActiveWebhooks();
        log.info(`[Webhooks] REFRESHED - ${Object.keys(this.active).length} active webhooks + ${this.counts.webhooks} events`);
      }
    } catch (error) {
      log.error('[Webhooks] ERROR - Failed to refresh webhooks:', error);
    } finally {
      setTimeout(() => this.refreshWebhooks(), this.refreshInterval);
    }
  }
}

let webhooks;

async function init() {
  const REFRESH_INTERVAL_MS = 20000;
  webhooks = await Webhooks.init(REFRESH_INTERVAL_MS);
  log.info('[Webhooks] INITIALISED');
}

async function publishEvent(event) {
  try {
    const { eventType, publicKey, requestId, data } = checkEvent(event);
    if (!webhooks.active.hasOwnProperty(publicKey)) return;

    const { endpoint, eventTypes } = webhooks.active[publicKey];
    if (!eventTypes.hasOwnProperty(eventType)) return;

    if (eventType === 'tx_sent') {
      await redis.setSentTxDetails(data.transactionHash, { requestId, accoundId: publicKey });
    }

    const eventData = { timestamp: Date.now(), event: eventTypes[eventType], publicKey, requestId, data };
    await sendToQueue(JSON.stringify({ endpoint, eventData }), publicKey);
  } catch (error) {
    log.error('[Webhooks] ERROR - Error publishing event', error);
    throw error;
  }
}

async function publishTransactionEvents(transactions) {
  for (const tx of transactions) {
    try {
      const { requestId, accountId } = await redis.getSentTxDetails(tx.transactionHash);
      if (!requestId) return;
      if (tx.status === 'Processed') {
        await publishEvent({ eventType: 'tx_succeeded', requestId, accountId, data: tx });
      } else if (tx.status === 'Rejected') {
        await publishEvent({ eventType: 'tx_succeeded', requestId, accountId, data: tx });
      }
      redis.deleteSentTxDetails(tx.transactionHash);
    } catch (error) {
      log.error('[Webhooks] ERROR - Error publishing transaction events', error);
    }
  }
}

function checkEvent(event) {
  const { eventType, accountId, requestId, data } = event;
  const missingParams = Object.entries(event)
    .filter(([, value]) => !value)
    .map(([key]) => key);
  if (missingParams.length > 0) {
    throw new Error(`[Webhooks] ERROR - Missing event params: ${missingParams.join(', ')}`);
  }
  if (!webhooks.eventTypes[eventType]) {
    throw new Error(`[Webhooks] ERROR - Invalid event type: ${eventType}`);
  }
  try {
    const publicKey = rds.getPublicKey(accountId);
    return { eventType, requestId, publicKey, data };
  } catch (error) {
    throw new Error(`[Webhooks] ERROR - Invalid accountId: ${accountId} - ${error}`);
  }
}

async function sendToQueue(message, messageGroup) {
  try {
    const params = {
      QueueUrl: config.webhooks.queue_url,
      MessageBody: message,
      MessageGroupId: messageGroup,
      MessageDeduplicationId: hash(message)
    };
    await sqsClient.send(new SendMessageCommand(params));
  } catch (error) {
    log.error('[Webhooks] ERROR - Error sending to queue', error);
    throw error;
  }
}

function hash(message) {
  return crypto.createHash('sha256').update(message).digest('hex');
}

module.exports = {
  init,
  publishEvent,
  publishTransactionEvents
};
