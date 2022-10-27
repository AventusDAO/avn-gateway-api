const assert = require('chai').assert;
const helper = require('./helper.js');
const accounts = helper.ACCOUNTS;

describe('Utilities', async () => {
  let api;

  before(async () => {
    api = await helper.avnApi();
  });

  describe('generateAccount', async () => {
    it('can generate a new account', async () => {
      const account = api.utils.generateNewAccount();
    });
  });

  describe('myAddress', async () => {
    it('can get my address', async () => {
      assert.equal(accounts.user.address, api.utils.myAddress());
      process.env.AVN_SURI = accounts.otherUser.seed;
      assert.equal(accounts.otherUser.address, api.utils.myAddress());
      process.env.AVN_SURI = accounts.user.seed;
    });
  });

  describe('myPublicKey', async () => {
    it('@NO_BASELINE can get my public key', async () => {
      assert.equal(accounts.user.publicKey, api.utils.myPublicKey());
      process.env.AVN_SURI = accounts.otherUser.seed;
      assert.equal(accounts.otherUser.publicKey, api.utils.myPublicKey());
      process.env.AVN_SURI = accounts.user.seed;
    });
  });

  describe('addressToPublicKey', async () => {
    it('can convert an address to a public key', async () => {
      const publicKey = api.utils.addressToPublicKey(accounts.otherUser.address);
      assert.equal(publicKey, accounts.otherUser.publicKey);
    });
  });
});
