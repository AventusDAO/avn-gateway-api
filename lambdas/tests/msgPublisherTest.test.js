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
const defaultEV = {
  'MQ_BROKER_AMQP_ENDPOINT': config.mq.mqBrokerAmqpEndpoint,
  'MQ_SECRET_ARN': config.mq.mqSecretArn,
  'SECRET_MANAGER_REGION': config.mq.secretManagerRegion
};

let amqpEndpointUrl = null;
let amqpConnection = null;
let amqpChannel = null;
let testMessages = [];
let messagesInQueue = [];

describe('Lambda function: msg-publisher-test', function() {
  before(async() => {
    await setup();
  })

  after(async() => {
    await cleanUp();
  })

  describe(`publish messages to MQ queue ${TEST_QUEUE_NAME}`, function() {
    describe('publish multiple messages when queue does not exist', async() => {
      before(async() => {
          generateTestMessages(PREFETCH_SIZE);
        await invokeLambdaFnToPublishTestMessages(testMessages);
      })

      it(`new messages are added to queue ${TEST_QUEUE_NAME}`, async() => {
        await assertMessagesInQueue(testMessages);
      })
    })
  })

  describe('Fails with', function(){
    it('Wrong MQ broker amqp endpoint', async() => {
      await updateLambdaEV({
        'MQ_BROKER_AMQP_ENDPOINT': 'abc',  
        'MQ_SECRET_ARN': config.mq.mqSecretArn,
        'SECRET_MANAGER_REGION': config.mq.secretManagerRegion
      });
      let response = await publishMessage(newTestMessage(31));
      assert(response.FunctionError && JSON.parse(response.Payload).errorType === 'Error');
    })

    it('wrong MQ secret arn', async() => {
      await updateLambdaEV({
        'MQ_BROKER_AMQP_ENDPOINT': config.mq.mqBrokerAmqpEndpoint,
        'MQ_SECRET_ARN': 'abc',
        'SECRET_MANAGER_REGION': config.mq.secretManagerRegion
      });
      let response = await publishMessage(newTestMessage(32));
      assert(response.FunctionError && JSON.parse(response.Payload).errorType === 'ResourceNotFoundException');
    })

    it('wrong secret manager region', async() => {
      await updateLambdaEV({
        'MQ_BROKER_AMQP_ENDPOINT': config.mq.mqBrokerAmqpEndpoint,
        'MQ_SECRET_ARN': config.mq.mqSecretArn,
        'SECRET_MANAGER_REGION': 'abc'
      });
      let response = await publishMessage(newTestMessage(33));
      assert(response.FunctionError && JSON.parse(response.Payload).errorType === 'UnknownEndpoint');
    })
  })
})

// ----------------------------- Helper functions -------------------------------------------------

async function setup() {
  await getAmqpEndpointUrl();
  await connectToMessageBroker();
  amqpChannel = await connectToChannel();
  await updateLambdaEV(defaultEV);
  deleteQueueInMQBroker();
}

async function cleanUp() {
  await updateLambdaEV(defaultEV);
  deleteQueueInMQBroker();
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
    messages.push(newTestMessage(i));
  }
  testMessages = messages;
}

function newTestMessage(id) {
  return {
    jsonrpc: "2.0", 
    method: "transferAvt", 
    params:["5DAgxVxKmnJ7hfhDEB9UetZm4jR2MPjGZGrmJZjirSVJDdMr", "2"],
    id: id
  }
}

async function invokeLambdaFnToPublishTestMessages(messages) {
  for (let i = 0; i<messages.length; i++) {
    let response = await publishMessage(messages[i]);
    assert(!response.FunctionError);
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

async function updateLambdaEV(variables) {
  return new Promise((resolve, reject) => {
    var params = {
      FunctionName: TEST_FN_NAME,
      Environment: {
        Variables: variables
      },
    };
    lambda.updateFunctionConfiguration(params, function(err, data) {
      if (err) throw err;
      resolve(data);
    });
  });
}