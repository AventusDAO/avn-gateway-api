'use strict';

const assert = require('assert');
const config = require('multiconfig').load({directory: '../../ec2/src/config/'});
const amqp = require('amqplib/callback_api');
const AWS = require('aws-sdk');
AWS.config.update({region: config.mq.secretManagerRegion});
const smClient = new AWS.SecretsManager();
const lambda = new AWS.Lambda();

const TEST_FN_NAME = 'msg-publisher-test';
const TEST_QUEUE_NAME = 'send-txn-queue';
const PREFETCH_SIZE = 30;

let amqpEndpointUrl = null;
let amqpConnection = null;
let amqpChannel = null;
let testMessages = [];
let messagesInQueue = [];

async function setup() {
  await getAmqpEndpointUrl();
  await connectToMessageBroker();
  amqpChannel = await connectToChannel();
  amqpTempChannel = await connectToChannel();
}

function cleanUp() {
  amqpConnection.close();
}

function getAmqpEndpointUrl() {
  return new Promise((resolve, reject) => {
    smClient.getSecretValue({SecretId: config.mq.mqSecretArn}, function(err, data) {
      if (err) throw err;
      if ('SecretString' in data) {
        let { username, password } = JSON.parse(data.SecretString);
        amqpEndpointUrl = config.mq.mqBrokerAmqpEndpoint.replace('amqps://', `amqps://${encodeURIComponent(username)}:${encodeURIComponent(password)}@`);
        resolve();
      }
    });
  });
}

function connectToMessageBroker() {
  return new Promise((resolve, reject) => {
    amqp.connect(amqpEndpointUrl, function(err, conn) {
      if (err) throw err;
      conn.on('error', function(err) {
        throw err;
      });
      amqpConnection = conn;
      resolve();
    });
  });
}

function connectToChannel() {
  return new Promise((resolve, reject) => {
    amqpConnection.createChannel(function(err, channel) {
      if (err) throw err;
      resolve(channel);
    });
  });
}

function deleteQueueInMQBroker() {
  amqpChannel.deleteQueue(TEST_QUEUE_NAME);
}

async function assertMessagesInQueue(messages) {
  amqpChannel.prefetch(PREFETCH_SIZE);
  await readAllMessagesFromQueue();
  for(let i = 0; i< messages.length; i++) {
    assert.deepEqual(messages[i], messagesInQueue[i]);
  }
}

function readAllMessagesFromQueue() {
  return new Promise((resolve, reject) => {
    let messageCounter = 0;
    amqpChannel.assertQueue(TEST_QUEUE_NAME, {durable: true}, (error2, response) => {
      const messageCount = response.messageCount;
      amqpChannel.consume(TEST_QUEUE_NAME, function (msg) {
        msg = msg.content.toString();
        messagesInQueue.push(JSON.parse(msg));
        if (messageCount === ++messageCounter) {
          resolve();
        }
      }, {
        noAck: true
      });
    });
  });
}

function generateTestMessages(numberOfMessages) {
  let messages = [];
  for(let i = 0; i<numberOfMessages; i++){
    messages.push({
      jsonrpc: "2.0", 
      method: "transferAvt", 
      params:["5DAgxVxKmnJ7hfhDEB9UetZm4jR2MPjGZGrmJZjirSVJDdMr", "2"], 
      id: i
    });
  }
  testMessages = messages;
}

async function invokeLambdaFnToPublishTestMessages() {
  for (let i = 0; i<testMessages.length; i++) {
    await publishMessage(testMessages[i]);
  }
}

async function publishMessage(message) {
  return new Promise((resolve, reject) => {
    var params = {
      FunctionName: TEST_FN_NAME,
      InvocationType: "RequestResponse",
      Payload: Buffer.from(JSON.stringify(message))
    };
    lambda.invoke(params, function(err, data) {
      if (err) throw err;
      resolve(data);
    });
  });
}

describe('Lambda function: msg-publisher-test', function() {
  before(async function() {
    await setup();
  })

  after(function() {
    deleteQueueInMQBroker();
    cleanUp();
  })

  describe(`publish messages to MQ queue ${TEST_QUEUE_NAME}`, function() {
    describe('publish multiple messages when queue does not exist', async() => {
      before(async() => {
        deleteQueueInMQBroker();
        generateTestMessages(PREFETCH_SIZE);
        await invokeLambdaFnToPublishTestMessages(TEST_FN_NAME);
      })

      it(`new messages are added to queue ${TEST_QUEUE_NAME}`, async() => {
        await assertMessagesInQueue(testMessages);
      })
    })
  })

  describe('Fails with', function(){
    it('wrong secret manager region', function(){
//          Before: Update the seceret manager region in environment variable to a different value
//          Invoke lambda function, assert error response
        })

        it('wrong MQ secret arn', function(){
//          Before: Update the seceret arn in environment variable to a different value
//          Invoke lambda function, assert error response
        })

        it('Wrong MQ broker amqp endpoint', function(){
//          Before: Update the MQ broker amqp endpoint in environment variable to a different value
//          Invoke lambda function, assert error response
        })
    })
})
