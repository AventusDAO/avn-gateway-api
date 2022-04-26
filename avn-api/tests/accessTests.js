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
    process.env.AVN_SURI = userSURI;
  });

  afterEach(async () => {
    process.env.AVN_SURI = userSURI;
  });

  describe('setSURI', async () => {
    it('can set AVN_SURI via the api', async () => {
      assert.equal(process.env.AVN_SURI, userSURI);
      api.setSURI(newUserSURI);
      assert.equal(process.env.AVN_SURI, newUserSURI);
    });

    it('can set AVN_SURI via the options', async () => {
      const options = { suri: newUserSURI };
      const apiWithOptions = new AvnApi(null, options);
      await apiWithOptions.init();
      assert.equal(process.env.AVN_SURI, newUserSURI);
    });
  });

  describe('accessing the gateway', async () => {
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
  });
});