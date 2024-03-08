const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');
const rds = require('./db/index');
const crypto = require('crypto');
const config = require('multiconfig').load();
const log = require('log4js').configure(config.log4Js).getLogger();
const sqsClient = new SQSClient({ region: config.aws.region });
const webhooks = new WebhooksUpdater(config.webhooks.refresh_interval_ms);

// Initializes the permitted event types and currently active webhooks, which are then kept up-to-date via periodic DB resyncs
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
      this.active = await rds.getActiveWebhooks();
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

async function publishEvent(event) {
  checkEvent(event);
  const { eventType, address, requestId, data } = event;
  const { endpoint, selectedEvents } = webhooks.active[address];
  if (!endpoint || !selectedEvents.includes(eventType)) return;
  const timestamp = Date.now();
  const body = JSON.stringify({ endpoint, data: { timestamp, address, requestId, eventType, data } });

  try {
    const params = {
      QueueUrl: config.webhooks.queue_url,
      MessageBody: body,
      MessageGroupId: address,
      MessageDeduplicationId: hash(messageBody)
    };
    await sqsClient.send(new SendMessageCommand(params));
  } catch (error) {
    log.error(`[Webhooks] ERROR - Error publishing event: ${body}}`, error);
  }
}

function checkEvent(event) {
  const { eventType, requestId, address, data } = event;
  const missingParams = Object.entries(params)
    .filter(([, value]) => !value)
    .map(([key]) => key);
  if (missingParams.length > 0) {
    throw new Error(`[Webhooks] ERROR - Missing params: ${missingParams.join(', ')}`);
  }
  if (!webhooks.EventTypes[eventType]) {
    throw new Error('[Webhooks] ERROR - Invalid event type');
  }
}

function hash(message) {
  return crypto.createHash('sha256').update(message).digest('hex');
}

module.exports = {
  publishEvent
};
