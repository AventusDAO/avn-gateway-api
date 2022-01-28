const chai = require('chai');
const expect = chai.expect;
const assert = chai.assert;
chai.use(require('chai-as-promised'));
const helper = require('./helper.js');
const accounts = helper.ACCOUNTS;
const BN = helper.BN;

/**
 * This method encapsulates in one call all the possible tests for an invalid account. It could be used with any account.
 * This simplifies the writing of the tests, by reducing the number of individual test cases we have to write.
 * But the arguments have to be tuned in a way that can be used generically.
 *
 * @param testConfig An object that can be used to create a valid request.
 * It should contain validCallData, selectionField and testFunction keys where,
 * testFunction is the function being tested,
 * validCallData is the arguments to this test function,
 * selectionField is the chosen argument to test
 */
async function invalidAccount(testConfig) {
  const selectionField = testConfig.selectionField;
  const testFunction = testConfig.testFunction;
  let callData = { ...testConfig.validCallData };

  it(selectionField + ' is empty', async () => {
    callData[selectionField] = '';
    await expect(testFunction(...Object.values(callData))).to.be.rejectedWith(/Expected non-null, non-empty base58 input/);
  });

  it(selectionField + ' is undefined', async () => {
    callData[selectionField] = undefined;
    await expect(testFunction(...Object.values(callData))).to.be.rejectedWith(/Expected non-null, non-empty base58 input/);
  });

  // Valid formats: SS58 (variable length) and hex string (fixed length: 32 bytes)
  it(selectionField + ' is in invalid format', async () => {
    callData[selectionField] = 'invalid_format';
    await expect(testFunction(...Object.values(callData))).to.be.rejectedWith(/Invalid base58 character/);
  });

  it(selectionField + ' is too short hex string to be a public key', async () => {
    const HEX_STRING_31_BYTES = '0x30ccad92fa31a27621c5fdf872c0244d92b0211662c5bce869d93edf79120f';
    callData[selectionField] = HEX_STRING_31_BYTES;
    await expect(testFunction(...Object.values(callData))).to.be.rejectedWith(
      /Expected a valid key to convert, with length 1, 2, 4, 8, 32, 33/
    );
  });

  it(selectionField + ' is too long hex string to be a public key', async () => {
    const HEX_STRING_34_BYTES = '0x30ccad92fa31a27621c5fdf872c0244d92b0211662c5bce869d93edf79120f2eab21';
    callData[selectionField] = HEX_STRING_34_BYTES;
    await expect(testFunction(...Object.values(callData))).to.be.rejectedWith(
      /Expected a valid key to convert, with length 1, 2, 4, 8, 32, 33/
    );
  });
}

async function invalidEthereumAddress(testConfig) {
  const selectionField = testConfig.selectionField;
  const testFunction = testConfig.testFunction;
  let callData = { ...testConfig.validCallData };

  it(selectionField + ' is empty', async () => {
    callData[selectionField] = '';
    await expect(testFunction(...Object.values(callData))).to.be.rejectedWith(/Invalid ethereum address type:/);
  });

  it(selectionField + ' is undefined', async () => {
    callData[selectionField] = undefined;
    await expect(testFunction(...Object.values(callData))).to.be.rejectedWith(/Invalid ethereum address type:/);
  });

  it(selectionField + ' is in invalid format', async () => {
    callData[selectionField] = 'invalid_format';
    await expect(testFunction(...Object.values(callData))).to.be.rejectedWith(/Invalid ethereum address type:/);
  });

  //Should I get size error here?
  it(selectionField + ' is too short ethereum address', async () => {
    const ETHEREUM_ADDRESS_19_BYTES = '0xb130395ae89acbe32999f8eb6e6114a56d6761';
    callData[selectionField] = ETHEREUM_ADDRESS_19_BYTES;
    await expect(testFunction(...Object.values(callData))).to.be.rejectedWith(/Invalid ethereum address type:/);
  });

  it(selectionField + ' is too long ethereum address', async () => {
    const ETHEREUM_ADDRESS_21_BYTES = '0xb130395ae89acbe32999f8eb6e6114a56d676199ab';
    callData[selectionField] = ETHEREUM_ADDRESS_21_BYTES;
    await expect(testFunction(...Object.values(callData))).to.be.rejectedWith(/Invalid ethereum address type:/);
  });
}

function invalidAmount(testConfig) {
  const selectionField = testConfig.selectionField;
  const testFunction = testConfig.testFunction;
  let callData = { ...testConfig.validCallData };

  //TODO: Fix "Cannot read property 'proxyTransfer' of undefined"
  xit(selectionField + ' is greater than senders balance', async () => {
    const api = await helper.avnApi();
    const senderAvtBalance = await api.query.getAvtBalance(accounts.sender.address);
    const greaterAmount = new BN(senderAvtBalance).add(new BN('1')).toString();
    callData[selectionField] = greaterAmount;
    console.log(testFunction(...Object.values(callData)));
  });

  //TODO Fix error message "Cannot read property 'toString' of undefined"
  xit(selectionField + ' is undefined', async () => {
    callData[selectionField] = undefined;
    console.log(await testFunction(...Object.values(callData)));
  });

  it(selectionField + ' is zero', async () => {
    callData[selectionField] = 0;
    await expect(testFunction(...Object.values(callData))).to.be.rejectedWith(/Invalid amount type:/);
  });

  it(selectionField + ' is a negative value', async () => {
    callData[selectionField] = -1;
    await expect(testFunction(...Object.values(callData))).to.be.rejectedWith(/Invalid amount type:/);
  });

  it(selectionField + ' is not a number', async () => {
    callData[selectionField] = 'string';
    await expect(testFunction(...Object.values(callData))).to.be.rejectedWith(/Invalid amount type:/);
  });
}

function invalidNftId(testConfig) {
  const selectionField = testConfig.selectionField;
  const testFunction = testConfig.testFunction;
  let callData = { ...testConfig.validCallData };

  it(selectionField + ' is empty', async () => {
    callData[selectionField] = '';
    await expect(testFunction(...Object.values(callData))).to.be.rejectedWith(/Cannot read property.*of undefined/);
  });

  it(selectionField + ' is undefined', async () => {
    callData[selectionField] = undefined;
    await expect(testFunction(...Object.values(callData))).to.be.rejectedWith(/Cannot read property.*of undefined/);
  });

  it(selectionField + ' doesnt exist', async () => {
    callData[selectionField] = 'idThatDoesntExist';
    await expect(testFunction(...Object.values(callData))).to.be.rejectedWith(/Cannot read property.*of undefined/);
  });
}

function invalidExternalReference(testConfig) {
  const selectionField = testConfig.selectionField;
  const testFunction = testConfig.testFunction;
  let callData = { ...testConfig.validCallData };

  it(selectionField + ' is empty', async () => {
    callData[selectionField] = '';
    await expect(testFunction(...Object.values(callData))).to.be.rejectedWith(/String is not populated:/);
  });

  it(selectionField + ' is undefined', async () => {
    callData[selectionField] = undefined;
    await expect(testFunction(...Object.values(callData))).to.be.rejectedWith(/String is not populated:/);
  });
}

function invalidRequestState(testConfig) {
  const selectionField = testConfig.selectionField;
  const testFunction = testConfig.testFunction;
  let callData = { ...testConfig.validCallData };

  it(selectionField + ' is empty', async () => {
    callData[selectionField] = '';
    await expect(testFunction(...Object.values(callData))).to.be.rejectedWith(/Invalid request ID type:/);
  });

  it(selectionField + ' is undefined', async () => {
    callData[selectionField] = undefined;
    await expect(testFunction(...Object.values(callData))).to.be.rejectedWith(/Invalid request ID type:/);
  });

  it(selectionField + ' valid but not existent', async () => {
    callData[selectionField] = 'idThatDoesntExist';
    await expect(testFunction(...Object.values(callData))).to.be.rejectedWith(/Invalid request ID type:/);
  });
}

module.exports = {
  invalidAccount,
  invalidAmount,
  invalidEthereumAddress,
  invalidNftId,
  invalidExternalReference,
  invalidRequestState
};
