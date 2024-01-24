const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');
const { hashString } = require('/opt/utils.js');
const sqsClient = new SQSClient({ region: process.env.AWS_REGION });

const queues = {
  TX: process.env.SQS_TX_QUEUE_URL,
  DEFAULT: process.env.SQS_DEFAULT_QUEUE_URL,
  PAYER: process.env.SQS_PAYER_QUEUE_URL
};

function getFailedMessagesForFifoQueue(records, successfulMessageCount) {
  if (!records || records.length === 0) return;

  // The first "successfulMessageCount" are processed successfully
  let failedMessages = records.slice(successfulMessageCount).map(r => {
    let item = { itemIdentifier: r.messageId };
    return item;
  });

  console.warn(`\n${failedMessages.length} messages failed to be processed from queue.`);
  return failedMessages;
}

async function sendToQueue(queueUrl, data) {
  const messageBody = JSON.stringify(data);
  const queueName = queueUrl.split('/').pop().split('.')[0];
  const params = {
    QueueUrl: queueUrl,
    MessageGroupId: queueName,
    MessageDeduplicationId: hashString(messageBody),
    MessageBody: messageBody
  };

  try {
    const result = await sqsClient.send(new SendMessageCommand(params));
    console.log(`Message sent to queue "${queueName}"`, result);
    return result;
  } catch (error) {
    console.error(`Failed to send message to queue "${queueName}"`, error);
    throw error;
  }
}

module.exports = {
  getFailedMessagesForFifoQueue,
  sendToQueue
};
