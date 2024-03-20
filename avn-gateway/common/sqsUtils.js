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

async function deleteMessagesFromQueue(queueUrl, entries) {
  try {
    await sqsClient.send(new DeleteMessageBatchCommand({ QueueUrl: queueUrl, Entries: entries }));
    console.log(`Deleted ${entries.length} messages from ${queueUrl}`);
  } catch (error) {
    console.error(`Failed to delete ${JSON.stringify(entries)} from ${queueUrl}`);
    throw error;
  }
}

module.exports = {
  deleteMessagesFromQueue,
  getFailedMessagesForFifoQueue,
  sendToQueue
};
