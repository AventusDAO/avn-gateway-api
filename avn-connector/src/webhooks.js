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
    this.lastEventsUpdate = new Date(Date.now()).toISOString();
    this.lastEventsCount = 0;
    this.lastEndpointsUpdate = new Date(Date.now()).toISOString();
    this.lastEndpointsCount = 0;
    this.initialize();
  }

  async initialize() {
    try {
      this.EventTypes = await rds.getWebhookEventTypes();
      this.active = await rds.getActiveWebhooks();
      this.lastEventsUpdate = await rds.getPayerWebhookEventsLastUpdate();
      this.lastEventsCount = await rds.getPayerWebhookEventsCount();
      this.lastEndpointsUpdate = await rds.getpayerWebhookEndpointsLastUpdate();
      this.lastEndpointsCount = await rds.getpayerWebhookEndpointsCount();
      this.refreshWebhooks();
    } catch (error) {
      log.error('[Webhooks] ERROR - Failed to initialize webhooks:', error);
    }
  }

  async updateWebhooks() {
    try {
      const latestEventsUpdate = await rds.getPayerWebhookEventsLastUpdate();
      const latestEventsCount = await rds.getPayerWebhookEventsCount();
      const latestEndpointsUpdate = await rds.getpayerWebhookEndpointsLastUpdate();
      const latestEndpointsCount = await rds.getpayerWebhookEndpointsCount();
      const eventsUpdated = this.lastEventsUpdate < latestEventsUpdate || this.lastEventsCount != latestEventsCount;
      const endpointsUpdated =
        this.lastEndpointsUpdate < latestEndpointsUpdate || this.lastEndpointsCount != latestEndpointsCount;

      if (eventsUpdated || endpointsUpdated) {
        this.active = await rds.getActiveWebhooks();
        this.lastEventsUpdate = latestEventsUpdate;
        this.lastEventsCount = latestEventsCount;
        this.lastEndpointsUpdate = latestEndpointsUpdate;
        this.lastEndpointsCount = latestEndpointsCount;
        log.info(`[Webhooks] Webhooks updated, ${Object.keys(this.active).length} webhooks active`);
      }
    } catch (error) {
      log.error('[Webhooks] ERROR - Failed to update webhooks', error);
    }
  }

  refreshWebhooks() {
    const refresh = async () => {
      await this.updateWebhooks();
      setTimeout(refresh, this.refreshInterval);
    };
    refresh();
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
    const { endpoints, eventTypes, payerVaultId } = webhooks.active[payerAddress];
    const description = eventTypes[eventType];
    if (!endpoints || !description) return;
    const eventData = { timestamp: Date.now(), event: description, address: payerAddress, requestId, data };
    await sendToQueue(JSON.stringify({ endpoints, eventData }), payerAddress);
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
