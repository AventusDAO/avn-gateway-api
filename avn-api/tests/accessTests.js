const AvnApi = require('avn-api');
const assert = require('chai').assert;
const helper = require('./helper.js');
const accounts = helper.ACCOUNTS;
const BN = helper.BN;
const bnEquals = helper.bnEquals;
const ONE_AVT = new BN('1000000000000000000');

describe('Access rights:', async () => {
  let api;
  let relayer, user, userSURI, newUser, newUserSURI, existingUserTestAccount, existingUser, existingUserSURI;

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

    existingUserTestAccount = api.utils.generateNewAccount();
    existingUser = existingUserTestAccount.address;
    existingUserSURI = existingUserTestAccount.seed;
  });

  afterEach(async () => {
    await api.setSURI(userSURI);
  });

  describe('setSURI', async () => {
    it('can set SURI via the api', async () => {
      assert.equal(api.myAddress(), user);
      assert.equal(api.signer().address, user);
      await api.setSURI(newUserSURI);
      assert.equal(api.myAddress(), newUser);
      assert.equal(api.signer().address, newUser);
    });

    it('can set SURI via the options', async () => {
      const options = { suri: newUserSURI, relayer: relayer };
      const apiWithOptions = await helper.avnApi(options);
      assert.equal(apiWithOptions.myAddress(), newUser);
      assert.equal(apiWithOptions.signer().address, newUser);
    });
  });

  describe('accessing the gateway', async () => {
    it('a new user cannot access the gateway without AVT', async () => {
      await api.setSURI(newUserSURI);
      assert.equal(await canAccessTheGateway(), false);

      // Transfer the new user enough AVT for entry
      await api.setSURI(userSURI);
      const requestId = await api.send.transferAvt(newUser, ONE_AVT.toString());
      await helper.confirmStatus(api, requestId, 'Processed');
      assert.equal(await api.query.getAvtBalance(newUser), ONE_AVT.toString());

      await api.setSURI(newUserSURI);
      assert.equal(await canAccessTheGateway(), true);
    });

    it('an existing user can access the gateway without AVT', async () => {
      await api.setSURI(userSURI);
      let requestId = await api.send.transferAvt(existingUser, ONE_AVT.toString());
      await helper.confirmStatus(api, requestId, 'Processed');
      assert.equal(await api.query.getAvtBalance(existingUser), ONE_AVT.toString());

      await api.setSURI(existingUserSURI);
      const relayerFee = await api.query.getRelayerFees(relayer, existingUser, 'proxyTokenTransfer');
      requestId = await api.send.transferAvt(user, ONE_AVT.sub(new BN(relayerFee)).toString());
      await helper.confirmStatus(api, requestId, 'Processed');

      await api.setSURI(userSURI); // this ensures the AWT token is refreshed
      assert.equal(await api.query.getAvtBalance(existingUser), '0'); // confirm existingUser now holds no AVT
      assert((await api.query.getNonce(existingUser, 'payment')) > 0);
      assert((await api.query.getNonce(existingUser, 'token')) > 0);

      await api.setSURI(existingUserSURI);
      assert.equal(await canAccessTheGateway(), true);
    });
  });
});
