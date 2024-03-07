const utils = require('/opt/utils.js');
const sns = require('/opt/snsUtils.js');

const WEBHOOK_SNS_TOPIC_PREFIX = 'gateway_webhook_';
const WEBHOOK_SNS_TOPIC_SUFFIX = '.fifo';

exports.handler = async event => {
  try {
    const { account, action, eventTypes, endpoint, token, webhook } = JSON.parse(event.body);
    const actions = {
      register: () => register(account, eventTypes, endpoint),
      confirm: () => confirm(account, token),
      update: () => update(account, eventTypes, webhook),
      deregister: () => deregister(account, webhook)
    };

    if (!actions[action]) {
      throw new Error('Invalid action');
    }

    const result = await actions[action]();
    return { statusCode: 200, body: JSON.stringify() };
  } catch (error) {
    return { statusCode: 400, body: JSON.stringify({ error: error.message }) };
  }
};

// Registers an https listener endpoint to receive specific tx events for an account
// Event types are validated by the sender
// The endpoint requires confirmation before it can start receiving these events
async function register(account, eventTypes, endpoint) {
  const topic = await getOrCreateTopic(account);
  await sns.subscribeToTopic(topic, endpoint, { account, eventType: eventTypes });
  return processResult('Webhook registered', { account, eventTypes, endpoint });
}

// Enables a registered endpoint to start receiving events by confirming the token it should have received upon registration
async function confirm(account, token) {
  const topic = await getTopic(account);
  const subscriptionArn = await sns.confirmTopicSubscription(topic, token);
  return processResult('Webhook confirmed', { account, webhook: subscriptionArn.split(':').pop() });
}

// Updates the set of events an existing webook will receive for an account
async function update(account, eventTypes, webhook) {
  const topic = await getTopic(account);
  await sns.updateSubscription(`${topic}:${webhook}`, { account, eventType: eventTypes });
  return processResult('Webhook updated', { account, eventTypes, webhook });
}

// Deregisters a webhook (and removes the tracked account's SNS topic if no other webhooks remain)
async function deregister(account, webhook) {
  const topic = await getTopic(account);
  await sns.unsubscribeFromTopic(`${topic}:${webhook}`);
  await deleteTopicIfOrphaned(topic);
  return processResult('Webhook deregistered', { account, webhook });
}

async function getOrCreateTopic(account) {
  const name = getTopicName(account);
  return (await sns.getTopic(name)) || (await sns.createTopic(name));
}

function getTopicName(account) {
  if (!utils.isValidAccountId(account)) throw new Error('Invalid account ID');
  return WEBHOOK_SNS_TOPIC_PREFIX + utils.convertToAddress(account) + WEBHOOK_SNS_TOPIC_SUFFIX;
}

async function getTopic(account) {
  const name = getTopicName(account);
  const topic = await sns.getTopic(name);
  if (!topic) throw new Error('Registration not found');
  return topic;
}

async function deleteTopicIfOrphaned(topic) {
  const subscribers = await sns.getTopicSubscribers(topic);
  if (subscribers.length === 0) {
    await sns.deleteTopic(topic);
  }
}

function processResult(message, data) {
  console.log(`${message}: ${JSON.stringify(data)}`);
  return { message, data };
}
