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
    this.initialize();
  }

  async initialize() {
    try {
      this.EventTypes = await rds.getWebhookEventTypes();
      this.active = await rds.getActiveWebhooks();
      this.refreshWebhooks();
    } catch (error) {
      console.error('[Webhooks] ERROR - Failed to initialize webhooks:', error);
    }
  }

  async updateWebhooks() {
    try {
      log.info(`[Webhooks] Updating webhooks before: ${JSON.stringify(this.active)}`);
      this.active = await rds.getActiveWebhooks();
      log.info(`[Webhooks] Updating webhooks after: ${JSON.stringify(this.active)}`);
    } catch (error) {
      console.error('[Webhooks] ERROR - Failed to update webhooks', error);
    }
  }

  refreshWebhooks() {
    setInterval(() => {
      this.updateWebhooks();
    }, this.refreshInterval);
  }
}

let webhooks;

async function init() {
  webhooks = new WebhooksUpdater(config.webhooks.refresh_interval_ms);
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
    log.error(`[Webhooks] ERROR - Error publishing event: ${error}`);
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
    const result = await sqsClient.send(new SendMessageCommand(params));
    log.info(`[Webhooks] - SENT TO QUEUE: ${params}      ${result}`);
  } catch (error) {
    log.error(`[Webhooks] ERROR - Error in sendToQueue: ${error}`);
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
