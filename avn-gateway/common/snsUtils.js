const {
  SNSClient,
  ConfirmSubscriptionCommand,
  CreateTopicCommand,
  DeleteTopicCommand,
  ListSubscriptionsByTopicCommand,
  paginateListTopics,
  SetSubscriptionAttributesCommand,
  SubscribeCommand,
  UnsubscribeCommand
} = require('@aws-sdk/client-sns');

const snsClient = new SNSClient({ region: process.env.AWS_REGION });

async function createTopic(topicName) {
  try {
    const command = new CreateTopicCommand({ Name: topicName, Attributes: { FifoTopic: true } });
    const response = await snsClient.send(command);
    return response.TopicArn;
  } catch (error) {
    console.error('Error creating SNS topic', error);
    throw error;
  }
}

async function deleteTopic(topicArn) {
  try {
    const command = new DeleteTopicCommand({ TopicArn: topicArn });
    await snsClient.send(command);
  } catch (error) {
    console.error('Error deleting SNS topic', error);
    throw error;
  }
}

async function getTopicArn(topicName) {
  try {
    const paginator = paginateListTopics({ client: snsClient }, {});
    for await (const page of paginator) {
      const foundTopic = page.Topics.find(topic => topic.TopicArn.includes(topicName));
      if (foundTopic) {
        return foundTopic.TopicArn;
      }
    }
    return undefined;
  } catch (error) {
    console.error('Error getting SNS topic:', error);
    throw error;
  }
}

async function subscribeToTopic(topicArn, endpoint, filterPolicy) {
  try {
    const command = new SubscribeCommand({
      TopicArn: topicArn,
      Protocol: 'https',
      Endpoint: endpoint,
      Attributes: {
        FilterPolicyScope: 'MessageAttributes',
        FilterPolicy: JSON.stringify(filterPolicy)
      }
    });
    await snsClient.send(command);
  } catch (error) {
    console.error('Error subscribing to SNS topic:', error);
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
    console.error('Error confirming SNS topic subscription:', error);
    throw error;
  }
}

async function unsubscribeFromTopic(subscriptionArn) {
  try {
    const command = new UnsubscribeCommand({ SubscriptionArn: subscriptionArn });
    await snsClient.send(command);
  } catch (error) {
    console.error('Error unsubscribing from SNS topic:', error);
    throw error;
  }
}

async function getTopicSubscribers(topicArn) {
  try {
    const command = new ListSubscriptionsByTopicCommand({ TopicArn: topicArn });
    const response = await snsClient.send(command);
    return response.Subscriptions;
  } catch (error) {
    console.error('Error getting SNS topic subscribers', error);
    throw error;
  }
}

async function updateSubscriptionFilterPolicy(subscriptionArn, newFilterPolicy) {
  try {
    const command = new SetSubscriptionAttributesCommand({
      SubscriptionArn: subscriptionArn,
      AttributeName: 'FilterPolicy',
      AttributeValue: JSON.stringify(newFilterPolicy)
    });
    const response = await snsClient.send(command);
    return response.SubscriptionArn;
  } catch (error) {
    console.error('Error updating filter policy for SNS topic subscription:', error);
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
