const chai = require('chai');
const expect = chai.expect;
chai.use(require('chai-as-promised'));
const helper = require('./helper.js');

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
  it(message + ' is empty', async () => {
    validCallData[fieldName] = '';
    await expect(testFunction(...Object.values(validCallData))).to.be.rejectedWith(/Expected non-null, non-empty base58 input/);
  });

  it(message + ' is undefined', async () => {
    validCallData[fieldName] = undefined;
    await expect(testFunction(...Object.values(validCallData))).to.be.rejectedWith(/Expected non-null, non-empty base58 input/);
  });

  // Valid formats: SS58 (variable length) and hex string (fixed length: 32 bytes)
  it(message + ' is in invalid format', async () => {
    validCallData[fieldName] = 'invalid_format';
    await expect(testFunction(...Object.values(validCallData))).to.be.rejectedWith(/Invalid base58 character/);
  });

  it(message + ' is too short hex string to be a public key', async () => {
    validCallData[fieldName] = '0x30ccad92fa31a27621c5fdf872c0244d92b0211662c5bce869d93edf79120f2';
    await expect(testFunction(...Object.values(validCallData))).to.be.rejectedWith(/Invalid base58 character/);
  });

  it(message + ' is too long hex string to be a public key', async () => {
    validCallData[fieldName] = '0x30ccad92fa31a27621c5fdf872c0244d92b0211662c5bce869d93edf79120f2eq';
    await expect(testFunction(...Object.values(validCallData))).to.be.rejectedWith(/Invalid base58 character/);
  });
}

function invalidAmount(message, fieldName, validCallData, testFunction) {
  it(message + 'is greater than senders balance', async () => {
    validCallData[fieldName] = 100000000000000000000000000000000000000000000000000000000000000;
    await expect(testFunction(...Object.values(validCallData))).to.be.rejectedWith(/Invalid amount type:/);
  });
  //TODO Fix error message "Cannot read property 'toString' of undefined"
  xit(message + 'is undefined', async () => {
    validCallData[fieldName] = undefined;
    console.log(await testFunction(...Object.values(validCallData)));
  });
  it(message + 'is zero', async () => {
    validCallData[fieldName] = 0;
    await expect(testFunction(...Object.values(validCallData))).to.be.rejectedWith(/Invalid amount type:/);
  });
  it(message + 'is a negative value', async () => {
    validCallData[fieldName] = -1;
    await expect(testFunction(...Object.values(validCallData))).to.be.rejectedWith(/Invalid amount type:/);
  });
  it(message + 'is not a number', async () => {
    validCallData[fieldName] = 'string';
    await expect(testFunction(...Object.values(validCallData))).to.be.rejectedWith(/Invalid amount type:/);
  });
}

function invalidEthereumToken(message, fieldName, validCallData, testFunction) {
  it(message + 'is empty', async () => {
    validCallData[fieldName] = '';
    await expect(testFunction(...Object.values(validCallData))).to.be.rejectedWith(/Invalid base58 character/);
  });
  it(message + 'is undefined', async () => {
    validCallData[fieldName] = undefined;
    await expect(testFunction(...Object.values(validCallData))).to.be.rejectedWith(/Invalid base58 character/);
  });
  it(message + 'is in invalid format', async () => {
    validCallData[fieldName] = 'invalid_format';
    await expect(testFunction(...Object.values(validCallData))).to.be.rejectedWith(/Invalid base58 character/);
  });
}

function invalidNftId(message, fieldName, validCallData, testFunction) {
  it(message + ' is empty', async () => {
    validCallData[fieldName] = '';
    await expect(testFunction(...Object.values(validCallData))).to.be.rejectedWith(
      /Cannot read property 'postRequest' of undefined/
    );
  });
  it(message + ' is undefined', async () => {
    validCallData[fieldName] = undefined;
    await expect(testFunction(...Object.values(validCallData))).to.be.rejectedWith(
      /Cannot read property 'postRequest' of undefined/
    );
  });
  it(message + ' doesnt exist', async () => {
    validCallData[fieldName] = 'idThatDoesntExist';
    await expect(testFunction(...Object.values(validCallData))).to.be.rejectedWith(
      /Cannot read property 'postRequest' of undefined/
    );
  });
}

function invalidExternalReference(message, fieldName, validCallData, testFunction) {
  it(message + 'is empty', async () => {
    validCallData[fieldName] = '';
    await expect(testFunction(...Object.values(validCallData))).to.be.rejectedWith(/String is not populated:/);
  });
  it(message + 'is undefined', async () => {
    validCallData[fieldName] = undefined;
    await expect(testFunction(...Object.values(validCallData))).to.be.rejectedWith(/String is not populated:/);
  });
  it(message + 'is in invalid format', async () => {
    validCallData[fieldName] = 'invalid_reference';
    await expect(testFunction(...Object.values(validCallData))).to.be.rejectedWith(
      /Cannot read property 'nftsMap' of undefined/
    );
  });
}

function invalidRequestState(message, fieldName, validCallData, testFunction) {
  it(message + ' is empty', async () => {
    validCallData[fieldName] = '';
    await expect(testFunction(...Object.values(validCallData))).to.be.rejectedWith(/Invalid request ID type:/);
  });
  it(message + ' is undefined', async () => {
    validCallData[fieldName] = undefined;
    await expect(testFunction(...Object.values(validCallData))).to.be.rejectedWith(/Invalid request ID type:/);
  });
  it(message + ' valid but not existent', async () => {
    validCallData[fieldName] = 'idThatDoesntExist';
    await expect(testFunction(...Object.values(validCallData))).to.be.rejectedWith(/Invalid request ID type:/);
  });
}

module.exports = {
  invalidAccount,
  invalidAmount,
  invalidEthereumToken,
  invalidNftId,
  invalidExternalReference,
  invalidRequestState
};
