const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');
const avn = require('./avn');
const rds = require('./db/index');
const crypto = require('crypto');
const config = require('multiconfig').load();
const log = require('log4js').configure(config.log4Js).getLogger();
const sqsClient = new SQSClient({ region: config.aws.region });

// Initializes the permitted event types and any active webhooks
// Webhooks are kept up-to-date via frequent DB resyncs that run in the background
class WebhooksUpdater {
  constructor(refreshInterval) {
    this.active = {};
    this.EventTypes = {};
    this.refreshInterval = refreshInterval;
    this.initialize();
  }

  async initialize() {
    try {
      await this.fetchAndUpdateWebhooks();
      this.refreshWebhooks();
    } catch (error) {
      log.error('[Webhooks] ERROR - Failed to initialize webhooks:', error);
    }
  }

  async fetchAndUpdateWebhooks() {
    const updates = await Promise.all([
      rds.getWebhookEventTypes(),
      rds.getActiveWebhooks(),
      rds.getWebhooksLastUpdated(),
      rds.getWebhooksCount(),
      rds.getWebhookEndpointLastUpdated(),
      rds.getWebhookEndpointCount()
    ]);

    this.EventTypes = updates[0];
    this.active = updates[1];
    [this.lastWebhooksUpdate, this.lastWebhooksCount, this.lastEndpointsUpdate, this.lastEndpointsCount] = updates.slice(2);
  }

  async updateWebhooks() {
    try {
      const [latestWebhooksUpdate, latestWebhooksCount, latestEndpointsUpdate, latestEndpointsCount] = await Promise.all([
        rds.getWebhooksLastUpdated(),
        rds.getWebhooksCount(),
        rds.getWebhookEndpointLastUpdated(),
        rds.getWebhookEndpointCount()
      ]);

      if (this.needsUpdate(latestWebhooksUpdate, latestWebhooksCount, latestEndpointsUpdate, latestEndpointsCount)) {
        await this.fetchAndUpdateWebhooks();
        log.info(`[Webhooks] Updated - ${Object.keys(this.active).length} active webhooks and ${latestWebhooksCount} events`);
      }
    } catch (error) {
      log.error('[Webhooks] ERROR - Failed to update webhooks', error);
    }
  }

  needsUpdate(latestWebhooksUpdate, latestWebhooksCount, latestEndpointsUpdate, latestEndpointsCount) {
    return (
      this.lastWebhooksUpdate < latestWebhooksUpdate ||
      this.lastWebhooksCount != latestWebhooksCount ||
      this.lastEndpointsUpdate < latestEndpointsUpdate ||
      this.lastEndpointsCount != latestEndpointsCount
    );
  }

  refreshWebhooks() {
    setTimeout(() => this.updateWebhooks(), this.refreshInterval);
  }
}

let webhooks;

async function init() {
  const REFRESH_INTERVAL_MS = 20000;
  webhooks = new WebhooksUpdater(REFRESH_INTERVAL_MS);
}

async function publishEvent(event) {
  return;
  try {
    const { eventType, publicKey, requestId, data } = checkEvent(event);
    if (!webhooks.active.hasOwnProperty(publicKey)) return;
    const { endpoint, eventTypes } = webhooks.active[publicKey];
    if (!eventTypes.hasOwnProperty(eventType)) return;
    const eventData = { timestamp: Date.now(), event: eventTypes[eventType], publicKey, requestId, data };
    await sendToQueue(JSON.stringify({ endpoint, eventData }), publicKey);
  } catch (error) {
    log.error('[Webhooks] ERROR - Error publishing event', error);
    throw error;
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
  if (!webhooks.EventTypes[eventType]) {
    throw new Error(`[Webhooks] ERROR - Invalid event type: ${eventType}`);
  }
  const publicKey = rds.getPublicKey(accountId);
  return { eventType, requestId, publicKey, data };
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
  publishEvent
};
