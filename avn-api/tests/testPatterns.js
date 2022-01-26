const chai = require('chai');
const expect = chai.expect;
const assert = chai.assert;
chai.use(require('chai-as-promised'));
const helper = require('./helper.js');
const accounts = helper.ACCOUNTS;

/**
 * This method encapsulates in one call all the possible tests for an invalid account. It could be used with any account.
 * This simplifies the writing of the tests, by reducing the number of individual test cases we have to write.
 * But the arguments have to be tuned in a way that can be used generically.
 *
 * @param message A context to qualify each individual test as part of this block
 * @param fieldName An identified to the part of the request (validCallData) that is being tested in this block.
 * @param validCallData An object that can be used to create a valid request. It should be as completely formed as possible,
 * so that this code (which is generic) does not have to know how to create requests
 * @param testFunction The function being tested
 */
async function invalidAccount(message, fieldName, validCallData, testFunction) {
  let callData = { ...validCallData }
  it(message + ' is empty', async () => {
    callData[fieldName] = '';
    await expect(testFunction(...Object.values(callData))).to.be.rejectedWith(/Expected non-null, non-empty base58 input/);
  });

  it(message + ' is undefined', async () => {
    callData[fieldName] = undefined;
    await expect(testFunction(...Object.values(callData))).to.be.rejectedWith(/Expected non-null, non-empty base58 input/);
  });

  // Valid formats: SS58 (variable length) and hex string (fixed length: 32 bytes)
  it(message + ' is in invalid format', async () => {
    callData[fieldName] = 'invalid_format';
    await expect(testFunction(...Object.values(callData))).to.be.rejectedWith(/Invalid base58 character/);
  });

  it(message + ' is too short hex string to be a public key', async () => {
    callData[fieldName] = '0x30ccad92fa31a27621c5fdf872c0244d92b0211662c5bce869d93edf79120f2';
    await expect(testFunction(...Object.values(callData))).to.be.rejectedWith(/Invalid base58 character/);
  });

  it(message + ' is too long hex string to be a public key', async () => {
    callData[fieldName] = '0x30ccad92fa31a27621c5fdf872c0244d92b0211662c5bce869d93edf79120f2eq';
    await expect(testFunction(...Object.values(callData))).to.be.rejectedWith(/Invalid base58 character/);
  });
}

async function invalidEthereumAccount(message, fieldName, validCallData, testFunction) {
  let callData = { ...validCallData }
  it(message + ' is empty', async () => {
    callData[fieldName] = '';
    await expect(testFunction(...Object.values(callData))).to.be.rejectedWith(/Invalid ethereum address type:/);
  });

  it(message + ' is undefined', async () => {
    callData[fieldName] = undefined;
    await expect(testFunction(...Object.values(callData))).to.be.rejectedWith(/Invalid ethereum address type:/);
  });

  // Valid formats: SS58 (variable length) and hex string (fixed length: 32 bytes)
  it(message + ' is in invalid format', async () => {
    callData[fieldName] = 'invalid_format';
    await expect(testFunction(...Object.values(callData))).to.be.rejectedWith(/Invalid ethereum address type:/);
  });
}

function invalidAmount(message, fieldName, validCallData, testFunction) {
  let callData = { ...validCallData }
  it(message + ' is greater than senders balance', async () => {
    callData[fieldName] = 100000000000000000000000000;
    await expect(testFunction(...Object.values(callData))).to.be.rejectedWith(/Invalid amount type:/);
  });
  //TODO Fix error message "Cannot read property 'toString' of undefined"
  xit(message + ' is undefined', async () => {
    callData[fieldName] = undefined;
    console.log(await testFunction(...Object.values(callData)));
  });
  it(message + ' is zero', async () => {
    callData[fieldName] = 0;
    await expect(testFunction(...Object.values(callData))).to.be.rejectedWith(/Invalid amount type:/);

  });
  it(message + ' is a negative value', async () => {
    callData[fieldName] = -1;
    await expect(testFunction(...Object.values(callData))).to.be.rejectedWith(/Invalid amount type:/);

  });
  it(message + ' is not a number', async () => {
    callData[fieldName] = 'string';
    await expect(testFunction(...Object.values(callData))).to.be.rejectedWith(/Invalid amount type:/);
  });
}

function invalidEthereumToken(message, fieldName, validCallData, testFunction) {
  let callData = { ...validCallData }
  it(message + 'is empty', async () => {
    callData[fieldName] = '';
    await expect(testFunction(...Object.values(callData))).to.be.rejectedWith(/Invalid ethereum address type:/);
  });
  it(message + 'is undefined', async () => {
    callData[fieldName] = undefined;
    await expect(testFunction(...Object.values(callData))).to.be.rejectedWith(/Invalid ethereum address type:/);
  });
  it(message + 'is in invalid format', async () => {
    callData[fieldName] = 'invalid_format';
    await expect(testFunction(...Object.values(callData))).to.be.rejectedWith(/Invalid ethereum address type:/);
  });
}

function invalidNftId(message, fieldName, validCallData, testFunction) {
  let callData = { ...validCallData }
  it(message + ' is empty', async () => {
    callData[fieldName] = '';
    await expect(testFunction(...Object.values(callData))).to.be.rejectedWith(
      /Cannot read property/
    );
  });
  it(message + ' is undefined', async () => {
    callData[fieldName] = undefined;
    await expect(testFunction(...Object.values(callData))).to.be.rejectedWith(
      /Cannot read property/
    );
  });
  it(message + ' doesnt exist', async () => {
    callData[fieldName] = 'idThatDoesntExist';
    await expect(testFunction(...Object.values(callData))).to.be.rejectedWith(
      /Cannot read property/
    );
  });
}

function invalidExternalReference(message, fieldName, validCallData, testFunction) {
  let callData = { ...validCallData }
  it(message + 'is empty', async () => {
    callData[fieldName] = '';
    await expect(testFunction(...Object.values(callData))).to.be.rejectedWith(/String is not populated:/);
  });
  it(message + 'is undefined', async () => {
    callData[fieldName] = undefined;
    await expect(testFunction(...Object.values(callData))).to.be.rejectedWith(/String is not populated:/);
  });
  it(message + 'is in invalid format', async () => {
    callData[fieldName] = 'invalid_reference';
    await expect(testFunction(...Object.values(callData))).to.be.rejectedWith(
      /Cannot read property/
    );
  });
}

function invalidRequestState(message, fieldName, validCallData, testFunction) {
  let callData = { ...validCallData }
  it(message + ' is empty', async () => {
    callData[fieldName] = '';
    await expect(testFunction(...Object.values(callData))).to.be.rejectedWith(/Invalid request ID type:/);
  });
  it(message + ' is undefined', async () => {
    callData[fieldName] = undefined;
    await expect(testFunction(...Object.values(callData))).to.be.rejectedWith(/Invalid request ID type:/);
  });
  it(message + ' valid but not existent', async () => {
    callData[fieldName] = 'idThatDoesntExist';
    await expect(testFunction(...Object.values(callData))).to.be.rejectedWith(/Invalid request ID type:/);
  });
}

module.exports = {
  invalidAccount,
  invalidAmount,
  invalidEthereumToken,
  invalidNftId,
  invalidExternalReference,
  invalidRequestState,
  invalidEthereumAccount
};
