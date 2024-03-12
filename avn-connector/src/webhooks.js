const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');
const avn = require('./avn');
const rds = require('./db/index');
const crypto = require('crypto');
const config = require('multiconfig').load();
const log = require('log4js').configure(config.log4Js).getLogger();
const sqsClient = new SQSClient({ region: config.aws.region });

let webhooks;

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

async function init() {
  webhooks = new WebhooksUpdater(config.webhooks.refresh_interval_ms);
}

async function publishEvent(event) {
  try {
    const { eventType, payerAddress, requestId, data } = checkEvent(event);
    const { endpoint, eventTypes, payerVaultId } = webhooks.active[payerAddress];
    const description = eventTypes[eventType];
    if (!endpoint || !description) return;
    const eventData = { timestamp: Date.now(), event: description, address: payerAddress, requestId, data };
    const payerSignedEventData = await signEventData(eventData, payerVaultId);
    const eventMessage = JSON.stringify({ endpoint, eventData, payerSignedEventData });
    await sendToQueue(payerAddress, eventMessage);
  } catch (error) {
    log.error(`[Webhooks] ERROR - Error publishing event: ${error}`, error);
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

async function signEventData(eventData, payerVaultId) {
  const eventMessage = 'AvnGatewayWebhookEvent' + JSON.stringify(eventData);
  return await avn.signWebhookEvent(eventMessage, payerVaultId);
}

async function sendToQueue(payerAddress, message) {
  try {
    const params = {
      QueueUrl: config.webhooks.queue_url,
      MessageBody: message,
      MessageGroupId: payerAddress,
      MessageDeduplicationId: hash(message)
    };
    await sqsClient.send(new SendMessageCommand(params));
  } catch (error) {
    log.error(`[Webhooks] ERROR - Error in sendToQueue: ${error}`, error);
    throw error;
  }
}

function hash(message) {
  return crypto.createHash('sha256').update(message).digest('hex');
}

module.exports = {
  publishEvent
};
