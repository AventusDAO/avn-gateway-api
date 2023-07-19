const AvnApi = require('avn-api');
const assert = require('chai').assert;
const helper = require('./helper.js');
const accounts = helper.ACCOUNTS;
const BN = helper.BN;
const bnEquals = helper.bnEquals;
const ONE_AVT = new BN('1000000000000000000');

describe('Access rights:', async () => {
  let multiUserApi, api;
  let relayer, user, userSURI, newUser, newUserSURI, existingUserTestAccount, existingUser, existingUserSURI;

  async function canAccessTheGateway(api) {
    try {
      // Any call which actually accesses the gateway (ie: is not cached in the api object) will do here
      await api.query.getTotalAvt();
    } catch (e) {
      return false;
    }
    return true;
  }

  before(async () => {
    const signer = {
      sign: async (data, signerAddress) => {
        return await helper.remoteSigner(data, signerAddress)
      }
    };

    multiUserApi = await helper.avnApi({
      signer: signer,
      relayer: relayer,
      setupMode : AvnApi.SetupMode.MultiUser,
      signingMode: AvnApi.SigningMode.RemoteSigner
    });

    relayer = accounts.relayer.address;
    user = accounts.user.address;
    userSURI = accounts.user.seed;

    newUserAccount = multiUserApi.utils.generateNewAccount();
    newUser = newUserAccount.address;
    newUserSURI = newUserAccount.seed;
    accounts["newUser"] = newUserAccount;

    existingUserTestAccount = multiUserApi.utils.generateNewAccount();
    existingUser = existingUserTestAccount.address;
    existingUserSURI = existingUserTestAccount.seed;
    accounts["existingUser"] = existingUserTestAccount;

    api = multiUserApi.apis(user)
  });

  afterEach(async () => {
    api = multiUserApi.apis(user)
  });

  describe('setOptions', async () => {
    it('can set new user via the options', async () => {
      const options = {
        suri: newUserSURI,
        relayer: relayer
      };
      const apiWithOptions = await helper.avnApi(options);
      assert.equal(apiWithOptions.myAddress, newUser);
      assert.equal(apiWithOptions.signer.address, newUser);
    });
  });

  describe('accessing the gateway', async () => {
    it('a new user cannot access the gateway without AVT', async () => {
      api = multiUserApi.apis(newUser)
      assert.equal(await canAccessTheGateway(api), false);

      // Transfer the new user enough AVT for entry
      api = multiUserApi.apis(user)
      const requestId = await api.send.transferAvt(newUser, ONE_AVT.toString());
      await helper.confirmStatus(api.poll, requestId, 'Processed');
      assert.equal(await api.query.getAvtBalance(newUser), ONE_AVT.toString());

      api = multiUserApi.apis(newUser)
      assert.equal(await canAccessTheGateway(api), true);
    });

    it('an existing user can access the gateway without AVT', async () => {
      let requestId = await api.send.transferAvt(existingUser, ONE_AVT.toString());
      await helper.confirmStatus(api.poll, requestId, 'Processed');
      assert.equal(await api.query.getAvtBalance(existingUser), ONE_AVT.toString());

      api = multiUserApi.apis(existingUser)
      const relayerFee = await api.query.getRelayerFees(relayer, existingUser, 'proxyTokenTransfer');
      requestId = await api.send.transferAvt(user, ONE_AVT.sub(new BN(relayerFee)).toString());
      await helper.confirmStatus(api.poll, requestId, 'Processed');

      api = multiUserApi.apis(user); // this ensures the AWT token is refreshed
      assert.equal(await api.query.getAvtBalance(existingUser), '0'); // confirm existingUser now holds no AVT
      assert((await api.query.getNonce(existingUser, 'payment')) > 0);
      assert((await api.query.getNonce(existingUser, 'token')) > 0);

      api = multiUserApi.apis(existingUser)
      assert.equal(await canAccessTheGateway(api), true);
    });
  });
});
