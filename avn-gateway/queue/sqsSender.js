const AWS = require('aws-sdk');
const SecretsManager = require('./secretsManager.js');

module.exports = SQSSender;

AWS.config.update({
  region: process.env.SECRET_MANAGER_REGION,
  accessKeyId: process.env.ACCESS_KEY_ID,
  secretAccessKey: process.env.SECRET_ACCESS_KEY_ID
});

const sqs = new AWS.SQS({ apiVersion: '2012-11-05' });

function SQSSender(secretsManagerRegion, secretArn, sqsQueueUrl) {
  this.secretsManager = new SecretsManager(secretsManagerRegion, console);
  this.secretArn = secretArn;
  this.sqsQueueUrl = sqsQueueUrl;
}

SQSSender.prototype.sendMessageToSQS = async function (message) {
  const params = {
    MessageBody: JSON.stringify(message),
    QueueUrl: this.sqsQueueUrl,
    DelaySeconds: 0
  };

  return await new Promise((resolve, reject) => {
    sqs.sendMessage(params, function (err, data) {
      if (err) {
        console.error("SQS Send Error", err);
        reject(err);
      } else {
        console.info('Sent message to SQS:', JSON.stringify(message));
        resolve(data.MessageId);
      }
    });
  });
};
