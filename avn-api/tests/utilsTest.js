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
      assert.equal(accounts.user.address, api.myAddress());
      assert.equal(accounts.user.address, api.signer().address);
      api.setSURI(accounts.otherUser.seed);
      assert.equal(accounts.otherUser.address, api.myAddress());
      assert.equal(accounts.otherUser.address, api.signer().address);
      api.setSURI(accounts.user.seed);
    });
  });

  describe('myPublicKey', async () => {
    it('@NO_BASELINE can get my public key', async () => {
      assert.equal(accounts.user.publicKey, api.myPublicKey());
      api.setSURI(accounts.otherUser.seed);
      assert.equal(accounts.otherUser.publicKey, api.myPublicKey());
      api.setSURI(accounts.user.seed);
    });
  });

  describe('addressToPublicKey', async () => {
    it('can convert an address to a public key', async () => {
      const publicKey = api.utils.addressToPublicKey(accounts.otherUser.address);
      assert.equal(publicKey, accounts.otherUser.publicKey);
    });
  });

  describe('setSuri updates awt token', async () => {
    it('for self pay tokens', async () => {
      const previousAWT = api.awtToken;
      api.setSURI(accounts.otherUser.seed);
      assert(previousAWT !== api.awtToken)
      api.setSURI(accounts.user.seed);
    });

    it('for split fee tokens', async () => {
      let options = {
        hasPayer: true,
        payer: '5FbUQ2kJWLoqHuSTSNNqBwKwdQnBVe4HF3TeGyu6UoZaryTh'
      };

      let apiWithOptions = await helper.avnApi(options);

      const previousAWT = apiWithOptions.awtToken;
      apiWithOptions.setSURI(accounts.otherUser.seed);
      assert(previousAWT !== apiWithOptions.awtToken);
      api.setSURI(accounts.user.seed);
    });

    it('even if suri does not change', async () => {
      api.setSURI(accounts.user.seed);
      const previousUserAddress = api.myAddress();
      const previousAWT = api.awtToken;
      api.setSURI(accounts.user.seed);
      assert.equal(previousUserAddress, api.myAddress());
      assert(previousAWT !== api.awtToken)
    });
  });
});
