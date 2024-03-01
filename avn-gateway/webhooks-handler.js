const sns = require('/opt/snsUtils.js');

exports.handler = async event => {
  try {
    const body = JSON.parse(event.body);
    let response;

    switch (body.operation) {
      case 'register':
        response = await registerWebhook(body.account, body.eventTypes, body.endpoint);
        break;
      case 'deregister':
        response = await deregisterWebhook(body.subscriptionArn, body.topicArn);
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

async function registerWebhook(account, eventTypes, endpoint) {
  try {
    const topicArn = await sns.createOrRetrieveTopic(account);
    const filter = { account: account, eventType: eventTypes };
    const subscriptionArn = await sns.subscribeToTopic(topicArn, filter, endpoint);
    console.log(`Webhook registered: ${JSON.stringify({ account, eventTypes, endpoint, topicArn, subscriptionArn })}`);
    return { message: 'Webhook registered successfully', subscriptionArn };
  } catch (error) {
    console.error('Error registering webhook:', error);
    throw error;
  }
}

async function deregisterWebhook(subscriptionArn) {
  try {
    await sns.unsubscribeFromTopic(subscriptionArn);
    const topicArn = sns.getTopicArn(subscriptionArn);
    const subscribers = await sns.getTopicSubscribers(topicArn);
    if (subscribers.length === 0) {
      await sns.deleteTopic(topicArn);
    }
    console.log(`Webhook deregistered: ${subscriptionArn}`);
    return { message: 'Webhook deregistered successfully', subscriptionArn };
  } catch (error) {
    console.error('Error deregistering webhook:', error);
    throw error;
  }
}
