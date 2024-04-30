import { SQSClient, SendMessageCommand, SendMessageCommandOutput } from '@aws-sdk/client-sqs';
import { hashString } from '/opt/utils';

const sqsClient = new SQSClient({ region: process.env.AWS_REGION });

interface MessageRecord {
  messageId: string;
}

interface FailedMessage {
  itemIdentifier: string;
}

function getFailedMessagesForFifoQueue(records: MessageRecord[], successfulMessageCount: number): FailedMessage[] {
  if (!records || records.length === 0) return;

  // The first "successfulMessageCount" are processed successfully
  let failedMessages: FailedMessage[] = records.slice(successfulMessageCount).map(r => ({ itemIdentifier: r.messageId }));

  console.warn(`\n${failedMessages.length} messages failed to be processed from queue.`);
  return failedMessages;
}

interface QueueData {
  QueueUrl: string;
  MessageGroupId: string;
  MessageDeduplicationId: string;
  MessageBody: string;
}

async function sendToQueue<T>(queueUrl: string, data: T): Promise<SendMessageCommandOutput> {
  const messageBody = JSON.stringify(data);
  const params: QueueData = {
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

export { getFailedMessagesForFifoQueue, sendToQueue };