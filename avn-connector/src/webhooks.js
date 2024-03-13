const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');
const avn = require('./avn');
const rds = require('./db/index');
const crypto = require('crypto');
const config = require('multiconfig').load();
const log = require('log4js').configure(config.log4Js).getLogger();
const sqsClient = new SQSClient({ region: config.aws.region });

// Initializes the permitted event types and any currently active webhooks
// Webhooks are kept up-to-date via periodic DB resyncs that run in the background
class WebhooksUpdater {
  constructor(refreshInterval) {
    this.active = {};
    this.EventTypes = {};
    this.refreshInterval = refreshInterval;
    this.lastUpdateTime = null;
    this.initialize();
  }

  async initialize() {
    try {
      this.EventTypes = await rds.getWebhookEventTypes();
      this.active = await rds.getActiveWebhooks();
      this.lastUpdateTime = await rds.getWebhooksLastUpdateTime();
      this.refreshWebhooks();
    } catch (error) {
      log.error('[Webhooks] ERROR - Failed to initialize webhooks:', error);
    }
  }

  async updateWebhooks() {
    try {
      const latestUpdateTime = await rds.getWebhooksLastUpdateTime();
      if (!this.lastUpdateTime || this.lastUpdateTime < latestUpdateTime) {
        this.active = await rds.getActiveWebhooks();
        this.lastUpdateTime = latestUpdateTime;
        log.info(`[Webhooks] Webhooks updated, ${Object.keys(this.active).length} webhooks active`);
      }
    } catch (error) {
      log.error('[Webhooks] ERROR - Failed to update webhooks', error);
    }
  }

  refreshWebhooks() {
    setInterval(() => {
      this.updateWebhooks();
    }, this.refreshInterval);
  }
}

let webhooks;
const REFRESH_INTERVAL_MS = 20000;

async function init() {
  webhooks = new WebhooksUpdater(REFRESH_INTERVAL_MS);
}

async function publishEvent(event) {
  try {
    const { eventType, payerAddress, requestId, data } = checkEvent(event);
    if (!webhooks.active.hasOwnProperty(payerAddress)) return;
    const { endpoint, eventTypes, payerVaultId } = webhooks.active[payerAddress];
    const description = eventTypes[eventType];
    if (!endpoint || !description) return;
    const eventData = { timestamp: Date.now(), event: description, address: payerAddress, requestId, data };
    await sendToQueue(JSON.stringify({ endpoint, eventData }), payerAddress);
  } catch (error) {
    log.error('[Webhooks] ERROR - Error publishing event', error);
    throw error;
  }
}

function checkEvent(event) {
  const { eventType, requestId, payerAddress, data } = event;
  const missingParams = Object.entries(event)
    .filter(([, value]) => !value)
    .map(([key]) => key);
  if (missingParams.length > 0) {
    throw new Error(`[Webhooks] ERROR - Missing event params: ${missingParams.join(', ')}`);
  }
  if (!webhooks.EventTypes[eventType]) {
    throw new Error(`[Webhooks] ERROR - Invalid event type: ${eventType}`);
  }
  return { eventType, requestId, payerAddress, data };
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
