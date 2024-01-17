const AWS = require('aws-sdk');
AWS.config.update({ region: process.env.AWS_REGION });
const sqs = new AWS.SQS({ apiVersion: '2012-11-05' });

function SQSSender(queueUrl) {
  this.queueUrl = queueUrl;
}

SQSSender.prototype.sendMessageToSQS = async function (message) {
  const params = {
    MessageBody: JSON.stringify(message),
    QueueUrl: this.queueUrl,
    DelaySeconds: 0
  };

  return await new Promise((resolve, reject) => {
    sqs.sendMessage(params, function (err, data) {
      if (err) {
        console.error('SQS Send Error', err);
        reject(err);
      } else {
        console.info('Sent message to SQS:', JSON.stringify(message));
        resolve(data.MessageId);
      }
    });
  });
};

module.exports = SQSSender;
