const {
  SNSClient,
  CreateTopicCommand,
  DeleteTopicCommand,
  ListSubscriptionsByTopicCommand,
  SubscribeCommand,
  UnsubscribeCommand
} = require('@aws-sdk/client-sns');

const snsClient = new SNSClient({ region: config.aws.region });

async function createOrRetrieveTopic(topicName) {
  try {
    const command = new CreateTopicCommand({ Name: topicName, Attributes: { FifoTopic: true } });
    const response = await snsClient.send(command);
    return response.TopicArn;
  } catch (error) {
    console.error('Error creating or retrieving topic', error);
    throw error;
  }
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
    const response = await snsClient.send(command);
    return response.SubscriptionArn;
  } catch (error) {
    console.error('Error subscribing to topic:', error);
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

function getTopicArn(subscriptionArn) {
  return subscriptionArn.substring(0, subscriptionArn.lastIndexOf(':'));
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

module.exports = {
  createOrRetrieveTopic,
  subscribeToTopic,
  unsubscribeFromTopic,
  getTopicSubscribers,
  getTopicArn,
  deleteTopic
};
