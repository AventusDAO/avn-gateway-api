const utils = require('/opt/utils.js');
const sns = require('/opt/snsUtils.js');

exports.handler = async event => {
  try {
    const body = JSON.parse(event.body);
    let response;

    switch (body.operation) {
      case 'register':
        response = await register(body.account, body.eventTypes, body.endpoint);
        break;
      case 'confirm':
        response = await confirm(body.account, body.token);
        break;
      case 'deregister':
        response = await deregister(body.account, body.webhook);
        break;
      default:
        throw new Error('Invalid operation');
    }

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
  try {
    let topicArn = await processAccount(account);
    if (!topicArn) {
      topicArn = await sns.createTopic(account);
    }
    const filterPolicy = { account: account, eventType: eventTypes };
    await sns.subscribeToTopic(topicArn, endpoint, filterPolicy);
    return processResult('Webhook registered', { account, eventTypes, endpoint });
  } catch (error) {
    console.error('Error registering webhook:', error);
    throw error;
  }
}

async function confirm(account, token) {
  try {
    const topicArn = await processAccount(account);
    if (!topicArn) {
      throw new Error('Register first');
    }
    const subscriptionArn = await sns.confirmTopicSubscription(topicArn, token);
    const webhook = subscriptionArn.split(':').pop();
    return processResult('Webhook confirmed', { account, webhook });
  } catch (error) {
    console.error('Error confirming webhook:', error);
    throw error;
  }
}

async function deregister(account, webhook) {
  try {
    const topicArn = await processAccount(account);
    if (!topicArn) {
      throw new Error('Registration does not exist');
    }
    const subscriptionArn = [topicArn, webhook].join(':');
    await sns.unsubscribeFromTopic(subscriptionArn);
    const subscribers = await sns.getTopicSubscribers(topicArn);
    if (subscribers.length === 0) {
      await sns.deleteTopic(topicArn);
    }
    return processResult('Webhook deregistered', { account, webhook });
  } catch (error) {
    console.error('Error deregistering webhook:', error);
    throw error;
  }
}

async function processAccount(account) {
  if (!utils.isValidAccountId(account)) throw new Error('Invalid account');
  return await sns.getTopicArn(utils.convertToAddress(account));
}

function processResult(message, data) {
  console.log(`${message}: ${JSON.stringify(data)}`);
  return { message, data };
}
