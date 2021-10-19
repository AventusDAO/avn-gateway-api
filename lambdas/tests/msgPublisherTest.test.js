'use strict';

const assert = require('assert');
const TEST_FN_NAME = 'msg-publisher-test'; 
const TEST_QUEUE_NAME = 'test-send-txn-queue';

describe('Lambda function: msg-publisher-test', function() {
    after(function() {
        deleteQueueInMQBroker(TEST_QUEUE_NAME);
    })

    describe(`publish messages to MQ queue ${TEST_QUEUE_NAME}`, function() {
        let singleTestMessage = [];
        let thirtyTestMessages = [];

        describe('publish 1 message when queue does not exist', function() {
            before(function(){
                assertQueueNotExistInMQBroker(TEST_QUEUE_NAME);
                singleTestMessage = generateMessages(1);
                invokeLambdaFn(TEST_FN_NAME, singleTestMessage, TEST_QUEUE_NAME);
            })

            describe('succeeded implies that', function() {
                it(`queue ${TEST_QUEUE_NAME} is created`, function(){
                    assertQueueExistInMQBroker(TEST_QUEUE_NAME);
                })

                it(`the new message is added to queue ${TEST_QUEUE_NAME}`, function(){
                    assertMessagesInQueue(singleTestMessage, TEST_QUEUE_NAME);
                })
            })
        })

        describe('publish 30 messages when queue already exist', function(){
            before(function() {
                thirtyTestMessages = generateMessages(30);
                invokeLambdaFn(TEST_FN_NAME, thirtyTestMessages, TEST_QUEUE_NAME);
            })

            it(`30 new messages are added to queue ${TEST_QUEUE_NAME}`, function(){
                assertMessagesInQueue([...singleTestMessage, ...thirtyTestMessages], TEST_QUEUE_NAME);
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
