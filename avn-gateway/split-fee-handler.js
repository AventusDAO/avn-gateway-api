// TODO:
//    Read messages from the PAYER queue
//    Do some basic validation
//    Generate payment info
//    Write the message to the DEFAULT queue

const utils = require('/opt/utils.js');

exports.handler = async (event, context) => {
  console.log(`split-fee-handler invoked with id: ${context.awsRequestId} and body: ${JSON.stringify(event.body)}`);

  return {
    statusCode: 200,
    body: JSON.stringify(utils.buildValidResponseBody(context.awsRequestId, "OK"))
  };
};