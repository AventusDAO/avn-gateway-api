const { SNSClient, PublishCommand, paginateListTopics } = require('@aws-sdk/client-sns');
const crypto = require('crypto');
const config = require('multiconfig').load();
const log = require('log4js').configure(config.log4Js).getLogger();
const snsClient = new SNSClient({ region: config.aws.region });

const trackedAccounts = new Map();
const REFRESH_PERIOD = config.webhooks.refresh_period_ms;
let lastRefresh = 0;

// TODO: Get these from the database
const Events = {
  transaction: {
    received: 'transaction received',
    sending: 'transaction sending',
    sent: 'transaction sent',
    succeeded: 'transaction succeeded',
    failed: 'transaction failed'
  },
  lower: {
    received: 'lower received',
    succeeded: 'lower succeeded',
    failed: 'lower failed'
  }
};

async function publishEvent(category, state, account, requestId, eventData) {
  const eventTime = Date.now();
  if (eventTime - lastRefresh > REFRESH_PERIOD) {
    await refreshAccountTracking(eventTime);
  }

  if (!trackedAccounts.has(account)) return;
  if (!Events[category]) throw new Error('[Webhook] ERROR - Invalid event category');
  if (!Events[category][state]) throw new Error('[Webhook] ERROR - Invalid event state');
  const eventType = Events[category][state];

  try {
    const eventData = {
      TopicArn: trackedAccounts.get(account),
      Message: JSON.stringify({ eventData, eventTime, eventType, requestId }),
      MessageAttributes: {
        eventType: {
          DataType: 'String',
          StringValue: eventType
        },
        account: {
          DataType: 'String',
          StringValue: account
        }
      },
      MessageGroupId: hash(account),
      MessageDeduplicationId: hash(requestId, eventType)
    };

    await snsClient.send(new PublishCommand(eventData));
  } catch (err) {
    log.error(`[Webhook] ERROR - Error publishing event: ${JSON.stringify({ account, eventType, eventData, requestId })}`, err);
  }
}

async function refreshAccountTracking(timeNow) {
  lastRefresh = timeNow;
  try {
    const paginator = paginateListTopics({ snsClient }, {});
    trackedAccounts.clear();
    for await (const page of paginator) {
      page.forEach(topic => trackedAccounts.set(page.topic, page.topic.TopicArn));
    }
  } catch (err) {
    log.error('[Webhook] ERROR - Error refreshing account tracking', err);
  }
}

function hash(...args) {
  return crypto.createHash('sha256').update(args.join('')).digest('hex');
}

module.exports = {
  publishEvent
};
