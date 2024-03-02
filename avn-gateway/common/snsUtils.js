const {
  SNSClient,
  ConfirmSubscriptionCommand,
  CreateTopicCommand,
  DeleteTopicCommand,
  ListSubscriptionsByTopicCommand,
  paginateListTopics,
  SubscribeCommand,
  UnsubscribeCommand
} = require('@aws-sdk/client-sns');

const awsRegion = process.env.AWS_REGION;
const snsClient = new SNSClient({ region: awsRegion });

async function createTopic(topicName) {
  try {
    const command = new CreateTopicCommand({ Name: topicName, Attributes: { FifoTopic: true } });
    const response = await snsClient.send(command);
    return response.TopicArn;
  } catch (error) {
    console.error('Error creating or retrieving topic', error);
    throw error;
  }
}

async function deleteTopic(topicArn) {
  try {
    const command = new DeleteTopicCommand({ TopicArn: topicArn });
    await snsClient.send(command);
  } catch (error) {
    console.error('Error deleting topic', error);
    throw error;
  }
}

async function getTopicArn(topicName) {
  const paginator = paginateListTopics({ client: snsClient }, {});
  for await (const page of paginator) {
    const foundTopic = page.Topics.find(topic => topic.TopicArn.includes(topicName));
    if (foundTopic) {
      return foundTopic.TopicArn;
    }
  }
  return undefined;
}

async function subscribeToTopic(topicArn, filter, endpoint) {
  try {
    const command = new SubscribeCommand({
      TopicArn: topicArn,
      Protocol: 'https',
      Endpoint: endpoint,
      Attributes: {
        FilterPolicyScope: 'MessageAttributes',
        FilterPolicy: JSON.stringify(filter)
      }
    });
    await snsClient.send(command);
  } catch (error) {
    console.error('Error subscribing to topic:', error);
    throw error;
  }
}

async function confirmTopicSubscription(topicArn, token) {
  try {
    const command = new ConfirmSubscriptionCommand({
      TopicArn: topicArn,
      Token: token,
      AuthenticateOnUnsubscribe: true
    });
    const response = await snsClient.send(command);
    return response.SubscriptionArn;
  } catch (error) {
    console.error('Error confirming topic subscription:', error);
    throw error;
  }
}

async function unsubscribeFromTopic(subscriptionArn) {
  try {
    const command = new UnsubscribeCommand({ SubscriptionArn: subscriptionArn });
    await snsClient.send(command);
  } catch (error) {
    console.error('Error unsubscribing from topic:', error);
    throw error;
  }
}

async function getTopicSubscribers(topicArn) {
  try {
    const command = new ListSubscriptionsByTopicCommand({ TopicArn: topicArn });
    const response = await snsClient.send(command);
    return response.Subscriptions;
  } catch (error) {
    console.error('Error getting subscribers', error);
    throw error;
  }
}

module.exports = {
  confirmTopicSubscription,
  createTopic,
  deleteTopic,
  getTopicArn,
  getTopicSubscribers,
  subscribeToTopic,
  unsubscribeFromTopic
};
