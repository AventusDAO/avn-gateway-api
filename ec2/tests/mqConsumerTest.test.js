// TO BE IMPLEMENTED

// Test Plan for mq-consumer-test.js sript

// BeforeAll:
//      Create a test queue in MQ
// AfterAll:
//      Delete the test queue 

// Test Cases
//  - Happy Path
//      BeforeEach: insert 30 messages synchronously
//      Start a single consumer script, then assert the print out messages are 1) the same as inserted ones, 2) no duplications, 3) in FIFO order, and 4) removed from queue
//      Start two consumer scripts, then assert in each consumer script print out, the messages are 1) from the inserted ones, 2) no duplications, 3) in FIFO order, and 4) removed from queue
//  - Unhappy Path:
//      BeforeAll: create some test config files
//      AfterAll: delete test config files
//      NACK(Negative Acknowledgement)
//          Run consumer script for multiple valid messages but one invalid message, assert the negative message is still in the queue, and others are removed from the queue
//          TODO: Update consumer script to check some conditions to decide ack or nack to keep or delete the message from queue
//      Wrong secret arn 
//          Run consumer script with wrong secret arn in config file to assert error printout, messages are still in the queue
//      Wrong secret region
//          Run consumer script with wrong secret region in config file to assert error printout, messages are still in the queue
//      Wrong MQ broker amqp endpoint
//          Run consumer script with wrong MQ broker amqp endpoint in config file to assert error printout, messages are still in the queue
