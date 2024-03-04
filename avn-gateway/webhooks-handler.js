const utils = require('/opt/utils.js');
const sns = require('/opt/snsUtils.js');

const OPERATIONS = { register, confirm, update, deregister };

exports.handler = async event => {
  try {
    const body = JSON.parse(event.body);
    const { account, eventTypes, endpoint, token, webhook } = body;
    if (!OPERATIONS[body.operation]) throw new Error('Invalid operation');
    const response = await OPERATIONS[body.operation](account, eventTypes || token, endpoint || webhook);
    return {
      statusCode: 200,
      body: JSON.stringify(response)
    };
  } catch (error) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: error.message })
    };
  }
};

async function register(account, eventTypes, endpoint) {
  const topicArn = (await processAccount(account)) || (await sns.createTopic(account));
  const filterPolicy = { account, eventType: eventTypes };
  await sns.subscribeToTopic(topicArn, endpoint, filterPolicy);
  return processResult('Webhook registered', { account, eventTypes, endpoint });
}

async function confirm(account, token) {
  const topicArn = await getValidatedTopicArn(account);
  const subscriptionArn = await sns.confirmTopicSubscription(topicArn, token);
  const webhook = subscriptionArn.split(':').pop();
  return processResult('Webhook confirmed', { account, webhook });
}

async function update(account, eventTypes, webhook) {
  const topicArn = await getValidatedTopicArn(account);
  const newFilterPolicy = { account, eventType: eventTypes };
  const subscriptionArn = [topicArn, webhook].join(':');
  await sns.updateSubscriptionFilterPolicy(subscriptionArn, newFilterPolicy);
  return processResult('Webhook updated', { account, eventTypes, webhook });
}

async function deregister(account, webhook) {
  const topicArn = await getValidatedTopicArn(account);
  const subscriptionArn = [topicArn, webhook].join(':');
  await sns.unsubscribeFromTopic(subscriptionArn);
  await deleteTopicIfOrphaned(topicArn);
  return processResult('Webhook deregistered', { account, webhook });
}

async function processAccount(account) {
  if (!utils.isValidAccountId(account)) throw new Error('Invalid account ID');
  return sns.getTopicArn(utils.convertToAddress(account));
}

async function getValidatedTopicArn(account) {
  const topicArn = await processAccount(account);
  if (!topicArn) throw new Error('Registration not found');
  return topicArn;
}

async function deleteTopicIfOrphaned(topicArn) {
  const subscribers = await sns.getTopicSubscribers(topicArn);
  if (subscribers.length === 0) {
    await sns.deleteTopic(topicArn);
  }
}

function processResult(message, data) {
  console.log(`${message}: ${JSON.stringify(data)}`);
  return { message, data };
}
