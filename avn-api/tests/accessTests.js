const AvnApi = require('../index.js');
const assert = require('chai').assert;
const helper = require('./helper.js');
const accounts = helper.ACCOUNTS;

describe('Access rights:', async () => {
  let api;
  let relayer, user, userSURI, newUser, newUserSURI;

  before(async () => {
    api = await helper.avnApi();
    relayer = accounts.relayer.address;
    user = accounts.user.address;
    userSURI = accounts.user.seed;
    newUserAccount = api.utils.generateNewAccount();
    newUser = newUserAccount.address;
    newUserSURI = newUserAccount.seed;
  });

  describe('setSURI', async () => {
    afterEach(async () => {
      process.env.AVN_SURI = userSURI;
    });

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
});
