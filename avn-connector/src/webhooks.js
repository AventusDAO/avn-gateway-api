const { SNSClient, PublishCommand, paginateListTopics } = require('@aws-sdk/client-sns');
const crypto = require('crypto');
const config = require('multiconfig').load();
const log = require('log4js').configure(config.log4Js).getLogger();
const snsClient = new SNSClient({ region: config.aws.region });

const REFRESH_TIME = 60 * 1000; // 1 minute
const trackedAccounts = new Map();
let lastRefresh = Date.now();

// TODO: Get these from the database
const Events = {
  Transaction: {
    Received: 'Transaction received',
    Sending: 'Transaction sending in progress',
    Sent: 'Transaction sent',
    Succeeded: 'Transaction executed successfully',
    Failed: 'Transaction failed'
  },
  Lower: {
    Received: 'Lower received',
    Failed: 'Lower failed'
  }
};

async function publishEvent(category, state, account, requestId, eventData) {
  const eventTime = Date.now();
  refreshTrackedAccountsIfRequired(eventTime);

  if (!trackedAccounts.has(account)) return;
  if (!Events[category]) throw new Error('Invalid event category');
  if (!Events[category][state]) throw new Error('Invalid event state');

  const eventType = Events[category][state];
  const payload = JSON.stringify({ requestId, eventType, eventTime, account, eventData });

  try {
    const eventData = {
      TopicArn: trackedAccounts.get(account),
      Message: payload,
      MessageAttributes: {
        // Filtering on attributes is less costly than filtering on payload data
        eventType: {
          DataType: 'String',
          StringValue: eventType
        },
        account: {
          DataType: 'String',
          StringValue: account
        }
      },
      MessageGroupId: hash(account), // SNS FIFO Topic grouping
      MessageDeduplicationId: hash(requestId, eventType)
    };

    await snsClient.send(new PublishCommand(eventData));
  } catch (err) {
    log.error(`Error publishing webhook event: ${payload}`, err);
    throw err;
  }
}

function refreshTrackedAccountsIfRequired(timeNow) {
  if (timeNow - lastRefresh > REFRESH_TIME) {
    lastRefresh = timeNow;
    updateAccountTracking();
  }
}

async function updateAccountTracking() {
  try {
    const paginator = paginateListTopics({ snsClient }, {});
    trackedAccounts.clear();
    for await (const page of paginator) {
      page.forEach(topic => trackedAccounts.set(page.topic, page.topic.TopicArn));
    }
  } catch (err) {
    log.error('Error updating webhook account tracking', err);
    throw err;
  }
}

function hash(...args) {
  return crypto.createHash('sha256').update(args.join('')).digest('hex');
}

module.exports = {
  publishEvent
};
