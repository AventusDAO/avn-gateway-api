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
      console.log(account);
    });
  });

  describe('addressToPublicKey', async () => {
    it('can convert an address to a public key', async () => {
      const publicKey = api.utils.addressToPublicKey(accounts.otherUser.address);
      assert.equal(publicKey, accounts.otherUser.publicKey);
    });
  });
});