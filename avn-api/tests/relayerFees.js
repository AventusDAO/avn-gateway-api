const chai = require('chai');
const expect = chai.expect;
const assert = chai.assert;
chai.use(require('chai-as-promised'));
const helper = require('./helper.js');
const accounts = helper.ACCOUNTS;
const _ = require('lodash');

async function verifyReturnedFees(fees) {
  for (const [key, value] of Object.entries(fees)) {
    assert.isString(value, `Fee for "${key}" should be a string`);
    assert.match(value, /^\d+$/, `Fee for "${key}" should be a numeric string`);
    assert.isTrue(BigInt(value) > 0n, `Fee for "${key}" should be greater than zero, but got ${value}`);
  }
}

describe('Relayer Fees:', async () => {
  let avnApi, api;
  let relayer, user, avt;

  before(async () => {
    avnApi = await helper.avnApi({
      suri: accounts.user.seed
    });
    api = await avnApi.apis();
    relayer = accounts.relayer;
    user = accounts.user;
    avt = await api.query.getAvtContractAddress();
  });

  describe('getRelayerFees', async () => {
    it('returns default fees for a relayer by address', async () => {
      const returnedFees = await api.query.getRelayerFees(relayer.address, avt);
      assert.isOk(returnedFees, 'Expected fees to be returned but got null or undefined');
      assert.isObject(returnedFees, 'Expected returned fees to be an object');
      await verifyReturnedFees(returnedFees);
    });

    it('returns default fees for a relayer by publicKey', async () => {
      const returnedFees = await api.query.getRelayerFees(relayer.publicKey, avt);
      assert.isOk(returnedFees, 'Expected fees to be returned but got null or undefined');
      assert.isObject(returnedFees, 'Expected returned fees to be an object');
      await verifyReturnedFees(returnedFees);
    });

    it('returns fees for a specific user by address', async () => {
      const returnedFees = await api.query.getRelayerFees(relayer.address, avt, user.address);
      assert.isOk(returnedFees, 'Expected fees to be returned but got null or undefined');
      assert.isObject(returnedFees, 'Expected returned fees to be an object');
      await verifyReturnedFees(returnedFees);
    });

    it('returns fees for a specific user by publicKey', async () => {
      const returnedFees = await api.query.getRelayerFees(relayer.publicKey, avt, user.publicKey);
      assert.isOk(returnedFees, 'Expected fees to be returned but got null or undefined');
      assert.isObject(returnedFees, 'Expected returned fees to be an object');
      await verifyReturnedFees(returnedFees);
    });

    it('returns the fee for a specific user and transaction type', async () => {
      const transactionType = 'proxyTokenTransfer';
      const returnedFee = await api.query.getRelayerFees(relayer.address, avt, user.publicKey, transactionType);
      assert.match(returnedFee, /^\d+$/, 'Expected fee to be a numeric string');
      assert.isTrue(BigInt(returnedFee) > 0n, `Expected fee to be greater than zero, but got ${returnedFee}`);
    });

    it('returns fees for a specific transaction type that has a default value for all users', async () => {
      const transactionType = 'proxyStakeAvt';
      const returnedFee = await api.query.getRelayerFees(relayer.address, avt, null, transactionType);
      assert.match(returnedFee, /^\d+$/, 'Expected fee to be a numeric string');
      assert.isTrue(BigInt(returnedFee) > 0n, `Expected fee to be greater than zero, but got ${returnedFee}`);
    });

    it('Errors if relayer is not specified for a specific transaction type and user', async () => {
      const transactionType = 'proxyStakeAvt';
      await expect(api.query.getRelayerFees(null, user.publicKey, transactionType)).to.be.rejectedWith(
        /Invalid empty address passed/
      );
    });

    it('errors if relayer is not registered', async () => {
      await expect(api.query.getRelayerFees(user)).to.be.rejectedWith(Error);
    });
  });
});
