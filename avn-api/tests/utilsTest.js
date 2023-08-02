const {AvnApi} = require('avn-api');
const assert = require('chai').assert;
const helper = require('./helper.js');
const accounts = helper.ACCOUNTS;

describe('Utilities', async () => {
  let api;

  before(async () => {
    api = await helper.avnApi({
      suri: helper.ACCOUNTS.user.seed
    });
  });

  describe('myAddress', async () => {
    it('can get my address', async () => {
      assert.equal(accounts.user.address, api.myAddress);
      assert.equal(accounts.user.address, api.signer.address);
    });
  });

  describe('myPublicKey', async () => {
    it('@NO_BASELINE can get my public key', async () => {
      assert.equal(accounts.user.publicKey, api.myPublicKey);
    });
  });

  xdescribe('setSuri updates awt token', async () => {
    it('for self pay tokens', async () => {
      const previousAWT = api.awtToken;
      await api.setSURI(accounts.otherUser.seed);
      assert(previousAWT !== api.awtToken);
      await api.setSURI(accounts.user.seed);
    });

    it('for split fee tokens', async () => {
      let options = {
        hasPayer: true,
        payer: accounts.payer.address,
        relayer: accounts.relayer.address
      };

      let apiWithOptions = await helper.avnApi(options);

      const previousAWT = apiWithOptions.awtToken;
      await apiWithOptions.setSURI(accounts.otherUser.seed);
      assert(previousAWT !== apiWithOptions.awtToken);
      await api.setSURI(accounts.user.seed);
    });

    it('even if suri does not change', async () => {
      await api.setSURI(accounts.user.seed);
      const previousUserAddress = api.myAddress();
      const previousAWT = api.awtToken;
      await api.setSURI(accounts.user.seed);
      assert.equal(previousUserAddress, api.myAddress());
      assert(previousAWT !== api.awtToken);
    });
  });

  describe('Utils', async () => {
    let nonInitialisedApi;
    before(async () => {
      // we are not calling init()
      nonInitialisedApi = new AvnApi(helper.GATEWAY, {
        suri: helper.ACCOUNTS.user.seed
      });
    });

    it('can generate a new account', async () => {
      const account = nonInitialisedApi.accountUtils.generateNewAccount();
      assert(account.address)
    });

    it('can convert an address to a public key', async () => {
      const publicKey = nonInitialisedApi.accountUtils.addressToPublicKey(accounts.otherUser.address);
      assert.equal(publicKey, accounts.otherUser.publicKey);
    });

    it('can still access utils after initialisation', async () => {
      const account = api.accountUtils.generateNewAccount();
      assert(account.address)
    });

    describe('publicKeyToAddress', async () => {
      it('can convert a publickey to an address', async () => {
        let address = nonInitialisedApi.accountUtils.publicKeyToAddress(accounts.otherUser.publicKey);
        assert.equal(address, accounts.otherUser.address);

        // it also works if we pass in an address
        address = nonInitialisedApi.accountUtils.publicKeyToAddress(accounts.otherUser.address);
        assert.equal(address, accounts.otherUser.address);
      });
    });

  });
});
