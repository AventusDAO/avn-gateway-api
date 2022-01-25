const chai = require('chai');
const expect = chai.expect;
const assert = chai.assert;

/**
 * This method encapsulates in one call all the possible tests for an invalid account. It could be used with any account.
 * This simplifies the writing of the tests, by reducing the number of individual test cases we have to write.
 * But the arguments have to be tuned in a way that can be used generically.
 *
 * @param message A context to qualify each individual test as part of this block
 * @param accountFieldName An identified to the part of the request (validCallData) that is being tested in this block.
 * @param validCallData An object that can be used to create a valid request. It should be as completely formed as possible,
 * so that this code (which is generic) does not have to know how to create requests
 */

async function invalidAccount(message, accoutAddress, validCallData) {
  it(message + ' is empty', async () => {
    // Modify call data by making a single account field invalid. In this case, empty
    // validCallData[accountFieldName] = ''
    // submit request
    // check success / failure
  });

  it(message + ' is undefined', async () => {
    // Modify call data by making a single account field invalid. In this case, undefined
    // validCallData[accountFieldName] = ''
    // submit request
    // check success / failure
  });

  // Valid formats: SS58 (variable length) and hex string (fixed length: 32 bytes)
  it(message + ' is in invalid format', async () => {});

  it(message + ' is too short hex string to be a public key', async () => {});

  it(message + ' is too ,ong hex string to be a public key', async () => {});
}

async function invalidEthereumAccount(message, accoutAddress, validCallData) {
  it(message + ' is empty');
  it(message + ' is undefined');
  it(message + ' is in invalid format');
}

function invalidAmount(message, amount, token, validCallData) {
  it(message + 'is greater than senders balance');
  it(message + 'is undefined');
  it(message + 'is zero');
  it(message + 'is a negative value');
  it(message + 'is not a number');
}

function invalidEthereumToken(message, token, validCallData) {
  it(message + 'is empty');
  it(message + 'is undefined');
  it(message + 'is in invalid format');
}

function invalidNftId(message, id, validCallData) {
  it(message + 'is empty');
  it(message + 'is undefined');
  it(message + 'doesnt exist');
}

function invalidExternalReference(message, id, validCallData) {
  it(message + 'is empty');
  it(message + 'is undefined');
  it(message + 'is in invalid format');
}

function invalidRequest(message, requestId, validCallData) {
  it(message + ' is empty');
  it(message + ' is undefined');
  it(message + ' valid but not existent');
}

module.exports = {
  invalidAccount,
  invalidAmount,
  invalidEthereumToken,
  invalidNftId,
  invalidExternalReference,
  invalidRequest,
  invalidEthereumAccount
};
