const AWS = require('aws-sdk');
const sqs = new AWS.SQS({region: process.env.QUEUE_REGION});

exports.handler = function(event, context) {
  const queueUrl = process.env.QUEUE_URL;
  var params = {
    QueueUrl: queueUrl,
    AttributeNames: ["MessageDeduplicationId", "MessageGroupId"],
    MaxNumberOfMessages: process.env.MAX_NUMBER_OF_MESSAGES,
    VisibilityTimeout: process.env.VISIBILITY_TIMEOUT_SECONDS,
    WaitTimeSeconds: 0
  };

  sqs.receiveMessage(params, function(err,data){
    if(err) {
      console.error('receiveMessage', err.stack);
      context.done('error', 'ERROR receiving messages from SQS');
    } else {
      receiptHandles = 
      console.info('data', JSON.stringify(data));
      context.done(null, JSON.stringify(data));
    }
  });
}