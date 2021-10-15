const AWS = require('aws-sdk');
const sqs = new AWS.SQS({region: process.env.QUEUE_REGION});

exports.handler = function(event, context) {

    var params = {
        MessageBody: JSON.stringify(event),
        QueueUrl: process.env.QUEUE_URL,
        MessageGroupId: event.MessageGroupId,
        MessageDeduplicationId: event.MessageDeduplicationId
    };

    sqs.sendMessage(params, function(err,data){
        if(err) {
            console.error('sendMessage', err.stack);
            context.done('error', 'ERROR sending messages to SQS');
          }else{
            console.info('data', JSON.stringify(data));
            context.done(null, JSON.stringify(data));
        }
    });
}