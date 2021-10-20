// TO BE IMPLEMENTED

// Test Plan for msg-publisher-test lambda function

// AfterAll
//      Delete the test queue in MQ

// Test cases:
//  - Happy path
//      Invoke lambda function 30 times synchronously, assert assert queue is created, and 30 messages are inserted in MQ as well
//  - Unhappy path
//      Wrong secret manager aws region
//          Before: Update the seceret manager region in environment variable to a wrong value
//          Invoke lambda function, assert error response
//      Wrong MQ secret arn
//          Before: Update the MQ secret arn in environment variable to a wrong value
//          Invoke lambda function, assert error response
//      Wrong MQ broker amqp endpoint
//          Before: Update the MQ broker amqp endpoint in environment variable to a wrong value
//          Invoke lambda function, assert error response