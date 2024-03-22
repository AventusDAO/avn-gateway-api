const { SQSClient, SendMessageCommand, DeleteMessageBatchCommand } = require('@aws-sdk/client-sqs');
const { hashString } = require('/opt/utils.js');
const sqsClient = new SQSClient({ region: process.env.AWS_REGION });

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
  const params = {
    QueueUrl: queueUrl,
    MessageGroupId: hashString(queueUrl),
    MessageDeduplicationId: hashString(messageBody),
    MessageBody: messageBody
  };

  try {
    const result = await sqsClient.send(new SendMessageCommand(params));
    console.log(`Message sent to queue "${queueUrl}"`, result);
    return result;
  } catch (error) {
    console.error(`Failed to send message to queue "${queueUrl}"`, error);
    throw error;
  }
}

async function removeFromQueue(queueUrl, entries) {
  const result = { succeeded: [], failed: [] };
  try {
    const response = await sqsClient.send(new DeleteMessageBatchCommand({ QueueUrl: queueUrl, Entries: entries }));
    result.succeeded = response.Successful?.map(entry => entry.Id) || [];
    result.failed = response.Failed?.map(entry => entry.Id) || [];
  } catch (error) {
    console.error(`Error removing entries from queue "${queueUrl}"`, error);
  } finally {
    return result;
  }
}

module.exports = {
  removeFromQueue,
  getFailedMessagesForFifoQueue,
  sendToQueue
};
