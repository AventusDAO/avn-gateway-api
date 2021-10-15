const AWS = require('aws-sdk');
const sqs = new AWS.SQS({region: process.env.QUEUE_REGION});

exports.handler = function(event, context) {
    // Prepare send message parameters
    var params = {
        MessageBody: JSON.stringify(event),
        QueueUrl: process.env.QUEUE_URL,
        MessageGroupId: event.MessageGroupId,
        MessageDeduplicationId: event.MessageDeduplicationId
    };

    // Send message to SQS fifo queue
    sqs.sendMessage(params, function(err,data){
        if(err) {
            console.log('error:',"Fail Send Message" + err);
            context.done('error', "ERROR sending message to SQS");
        }else{
            console.log('data:',data.MessageId);
            context.done(null, JSON.stringify(data));
        }
    });
}