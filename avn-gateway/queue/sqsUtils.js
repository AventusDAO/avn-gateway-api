const { SQSClient, SendMessageCommand } = require("@aws-sdk/client-sqs");

function getFailedMessagesForFifoQueue(records, successfulMessageCount) {
  if (!records || records.length === 0) return;

  // The first "successfulMessageCount" are processed successfully
  let failedMessages = records.slice(successfulMessageCount).map(r => {
    let item = {"itemIdentifier": r.messageId}
    return item;
  });

  console.warn(`\n${failedMessages.length} messages failed to be processed from queue.`)
  return failedMessages;
}

// Keep alphabetical
module.exports = {
  getFailedMessagesForFifoQueue,
  SQSClient,
  SendMessageCommand
};