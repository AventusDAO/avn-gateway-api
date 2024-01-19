const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');
const { hashString } = require('/opt/utils.js');
const sqsClient = new SQSClient({ region: process.env.AWS_REGION });

const queues = {
  AVN_TX: process.env.SQS_AVN_TX_QUEUE_URL,
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

async function sendToQueue(queue, data) {
  const messageBody = JSON.stringify(data);

  const params = {
    QueueUrl: queues[queue],
    MessageGroupId: queue,
    MessageDeduplicationId: hashString(messageBody),
    MessageBody: messageBody
  };

  return await sqsClient.send(new sqs.SendMessageCommand(params));
}

module.exports = {
  getFailedMessagesForFifoQueue,
  sendToQueue
};
