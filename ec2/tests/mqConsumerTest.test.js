// TO BE IMPLEMENTED

// Test Plan for mq-consumer-test.js sript

// BeforeAll:
//      Create a test queue in MQ
// AfterAll:
//      Delete the test queue 

// Test Cases
//  - Happy Path
//      BeforeEach: insert 30 messages synchronously
//      Start a single consumer script, then assert the print out messages are the same as inserted ones, and in FIFO order
//      Start two consumer scripts, then assert in each consumer script print out, the messages are from the inserted ones, no deuplications, and in FIFO order
//  - Unhappy Path:
//      BeforeAll: create some test config files
//      AfterAll: delete test config files
//      Wrong secret arn 
//          Run consuemr script with wrong secret arn in config file to assert error printout
//      Wrong secret region
//          Run consuemr script with wrong secret region in config file to assert error printout
//      Wrong MQ broker amqp endpoint
//          Run consuemr script with wrong MQ broker amqp endpoint in config file to assert error printout
