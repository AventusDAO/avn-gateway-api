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
 * @param validCallData An object that can be used to create a valid request. It should be as completely formed as possible,
 * so that this code (which is generic) does not have to know how to create requests
 * @param testFunction The function being tested
 */
async function invalidAccount(message, validCallData, testFunction) {
  let callData = { ...validCallData };
  const fieldName = 'account'
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

  //TODO: Fix error mesage for too short or too long
  it(message + ' is too short hex string to be a public key', async () => {
    const HEX_STRING_31_BYTES = '0x30ccad92fa31a27621c5fdf872c0244d92b0211662c5bce869d93edf79120f'
    callData[fieldName] = HEX_STRING_31_BYTES;
    await expect(testFunction(...Object.values(callData))).to.be.rejectedWith(/Invalid base58 character/);
  });

  //TODO: Fix error mesage for too short or too long
  it(message + ' is too long hex string to be a public key', async () => {
    const HEX_STRING_33_BYTES = '0x30ccad92fa31a27621c5fdf872c0244d92b0211662c5bce869d93edf79120f2eq3'
    callData[fieldName] = HEX_STRING_33_BYTES;
    await expect(testFunction(...Object.values(callData))).to.be.rejectedWith(/Invalid base58 character/);
  });
}

async function invalidEthereumAddress(message, validCallData, testFunction) {
  let callData = { ...validCallData };
  const fieldName = 'ethereumAddress';
  it(message + ' is empty', async () => {
    callData[fieldName] = '';
    await expect(testFunction(...Object.values(callData))).to.be.rejectedWith(/Invalid ethereum address type:/);
  });
  it(message + ' is undefined', async () => {
    callData[fieldName] = undefined;
    await expect(testFunction(...Object.values(callData))).to.be.rejectedWith(/Invalid ethereum address type:/);
  });
  it(message + ' is in invalid format', async () => {
    callData[fieldName] = 'invalid_format';
    await expect(testFunction(...Object.values(callData))).to.be.rejectedWith(/Invalid ethereum address type:/);
  });
  it(message + ' is too short ethereum address', async () => {
    const ETHEREUM_ADDRESS_19_BYTES = '0xb130395ae89acbe32999f8eb6e6114a56d6761'
    callData[fieldName] = HEX_STRING_30_BYTES;
    await expect(testFunction(...Object.values(callData))).to.be.rejectedWith(Error);
  });

  it(message + ' is too long ethereum address', async () => {
    const ETHEREUM_ADDRESS_21_BYTES = '0xb130395ae89acbe32999f8eb6e6114a56d676199eq'
    callData[fieldName] = HEX_STRING_31_BYTES;
    await expect(testFunction(...Object.values(callData))).to.be.rejectedWith(Error);
  });
}

function invalidAmount(message, validCallData, testFunction) {
  let callData = { ...validCallData };
  const fieldName = 'amount';
  //TODO: Fix "invalid amount type" by "not enough balance"
  it(message + ' is greater than senders balance', async () => {
    callData[fieldName] = 10000000000000000000000000000;
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

function invalidNftId(message, validCallData, testFunction) {
  let callData = { ...validCallData };
  const fieldName = 'nftId'
  it(message + ' is empty', async () => {
    callData[fieldName] = '';
    await expect(testFunction(...Object.values(callData))).to.be.rejectedWith(/Cannot read property/);
  });
  it(message + ' is undefined', async () => {
    callData[fieldName] = undefined;
    await expect(testFunction(...Object.values(callData))).to.be.rejectedWith(/Cannot read property/);
  });
  it(message + ' doesnt exist', async () => {
    callData[fieldName] = 'idThatDoesntExist';
    await expect(testFunction(...Object.values(callData))).to.be.rejectedWith(/Cannot read property/);
  });
}

function invalidExternalReference(message, validCallData, testFunction) {
  let callData = { ...validCallData };
  const fieldName = 'externalReference'
  it(message + ' is empty', async () => {
    callData[fieldName] = '';
    await expect(testFunction(...Object.values(callData))).to.be.rejectedWith(/String is not populated:/);
  });
  it(message + ' is undefined', async () => {
    callData[fieldName] = undefined;
    await expect(testFunction(...Object.values(callData))).to.be.rejectedWith(/String is not populated:/);
  });
}

function invalidRequestState(message, validCallData, testFunction) {
  let callData = { ...validCallData };
  const fieldName = 'requestId'
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
  invalidEthereumAddress,
  invalidNftId,
  invalidExternalReference,
  invalidRequestState,
};
