// This script is started by executing command `/ec2/src$ node mq-consumer-test.js`
// It keeps pulling messages from a message queue synchronously, and try to reconnect if a connection is closed or failed be established.
// It receives a number of messages specified in the configuration file, then prints out each message as `Sent request [message]`,
// and finally acknowledges the queue to delete the message.

// TODO: Integrate with existing services

'use strict'

const config = require('multiconfig').load();
const avn = require('./avn');
const redis = require('./redis')
const logger = require('log4js').configure(config.log4Js).getLogger();
const MessageQueue = require('../../lambdas/send-handler-mq/messageQueue.js');

async function start() {
  await avn.connectToAvN()
  await redis.connect()
  let mq = new MessageQueue(
    config.mq.secretManagerRegion, 
    config.mq.mqSecretArn,
    config.mq.mqBrokerAmqpEndpoint
  );
  await mq.processMessagesFromMq( 
    config.mq.mqAvnTxnQueue,
    sendAvnTxn
  );
};

async function sendAvnTxn(request, callback) {
  try {
    logger.trace(`request body: ${JSON.stringify(request)}`);
    const result = await avn.tx(request.palletName, request.method, request.params);
    logger.info(`Request sent with ID: ${result.requestId} and received result: ${JSON.stringify(result)}`);
    callback(true);
  } catch (err) {
    // TODO: SYS-1530 Requeue or drop the messages based on error type when sending txns to AVN
    const requeue = true;
    callback(false, requeue);
  }
}

function closeOnErr(err) {
  if (!err) return false;
  logger.error("[AMQP] error", err);
  amqpConn.close();
  return true;
}

start();