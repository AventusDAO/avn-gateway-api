const AvnApi = require('../index.js');
const assert = require('chai').assert;
const helper = require('./helper.js');
const accounts = helper.ACCOUNTS;
const BN = helper.BN;
const bnEquals = helper.bnEquals;
const ONE_AVT = new BN('1000000000000000000');

describe('Access rights:', async () => {
  let api;
  let relayer, user, userSURI, newUser, newUserSURI;

  async function canAccessTheGateway() {
    try {
      // Any call which actually accesses the gateway (ie: is not cached in the api object) will do here
      await api.query.getTotalAvt();
    } catch (e) {
      return false;
    }
    return true;
  }

  before(async () => {
    api = await helper.avnApi();
    relayer = accounts.relayer.address;
    user = accounts.user.address;
    userSURI = accounts.user.seed;
    newUserAccount = api.utils.generateNewAccount();
    newUser = newUserAccount.address;
    newUserSURI = newUserAccount.seed;
  });

  afterEach(async () => {
    api.setSURI(userSURI);
  });

  describe('setSURI', async () => {
    it('can set SURI via the api', async () => {
      assert.equal(api.myAddress(), user);
      assert.equal(api.signer().address, user);
      api.setSURI(newUserSURI);
      assert.equal(api.myAddress(), newUser);
      assert.equal(api.signer().address, newUser);
    });

    it('can set SURI via the options', async () => {
      const options = { suri: newUserSURI };
      const apiWithOptions = new AvnApi(null, options);
      await apiWithOptions.init();
      assert.equal(apiWithOptions.myAddress(), newUser);
      assert.equal(apiWithOptions.signer().address, newUser);
    });
  });

  describe('accessing the gateway', async () => {
    // Note: these tests depend on each other
    it('a new user cannot access the gateway without AVT', async () => {
      api.setSURI(newUserSURI);
      assert.equal(await canAccessTheGateway(), false);

      // Transfer the new user enough AVT for entry
      api.setSURI(userSURI);
      const requestId = await api.send.transferAvt(relayer, newUser, ONE_AVT.toString());
      await helper.confirmStatus(api, requestId, 'Processed');
      assert.equal(await api.query.getAvtBalance(newUser), ONE_AVT.toString());

      api.setSURI(newUserSURI);
      assert.equal(await canAccessTheGateway(), true);
    });

    it('an existing user can access the gateway without AVT', async () => {
      // New user returns all their loaned AVT
      api.setSURI(newUserSURI);
      const relayerFee = await api.query.getRelayerFees(relayer, newUser, 'proxyTokenTransfer');
      const requestId = await api.send.transferAvt(relayer, user, ONE_AVT.sub(new BN(relayerFee)).toString());
      await helper.confirmStatus(api, requestId, 'Processed');

      api.setSURI(userSURI); // this ensures the AWT token is refreshed
      assert.equal(await api.query.getAvtBalance(newUser), '0'); // confirm newUser now holds no AVT

      api.setSURI(newUserSURI);
      assert.equal(await canAccessTheGateway(), true);
    });

    it('signer is updated when changing suri via the api', async () => {
      api.setSURI(newUserSURI);
      assert.equal(await api.query.getAvtBalance(newUser), '0');

      // New user cannot transfer avt with 0 balance
      let requestId = await api.send.transferAvt(relayer, user, ONE_AVT.toString());
      await helper.confirmStatus(api, requestId, 'Rejected');

      api.setSURI(userSURI); // this ensures the AWT token is refreshed
      assert(new BN(await api.query.getAvtBalance(user)).gte(ONE_AVT));

      // User can transfer AVT because they have at least 1 avt
      requestId = await api.send.transferAvt(relayer, user, ONE_AVT.toString());
      await helper.confirmStatus(api, requestId, 'Processed');
    });
  });
});
