const { SetupMode, SigningMode } = require('avn-api');
const assert = require('chai').assert;
const helper = require('./helper.js');
const accounts = helper.ACCOUNTS;
const BN = helper.BN;
const ONE_AVT = helper.convertToBaseUnits(1);

const {
  registerSplitFeeUser
} = require('./splitFeeHelper');


describe('Access rights:', async () => {
  let avnGateway, api, options;
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
    relayer = accounts.relayer.address;
    user = accounts.user.address;
    userSURI = accounts.user.seed;

    const signer = {
      sign: async (data, signerAddress) => {
        return await helper.remoteSigner(data, signerAddress);
      }
    };

    options = {
      signer: signer,
      relayer: relayer,
      setupMode: SetupMode.MultiUser,
      signingMode: SigningMode.RemoteSigner
    };

    avnGateway = await helper.avnApi(options);
    api = await avnGateway.apis(user);

    newUserAccount = avnGateway.accountUtils.generateNewAccount();
    newUser = newUserAccount.address;
    newUserSURI = newUserAccount.seed;
    accounts['newUser'] = newUserAccount;

    existingUserTestAccount = avnGateway.accountUtils.generateNewAccount();
    existingUser = existingUserTestAccount.address;
    existingUserSURI = existingUserTestAccount.seed;
    accounts['existingUser'] = existingUserTestAccount;
  });

  afterEach(async () => {
    api = await avnGateway.apis(user);
  });

  describe('accessing the gateway', async () => {
    it('a new user cannot access the gateway without AVT', async () => {
      api = await avnGateway.apis(newUser);
      assert.equal(await canAccessTheGateway(api), false);

      // Transfer the new user enough AVT for entry
      api = await avnGateway.apis(user);
      const requestId = await api.send.transferAvt(newUser, ONE_AVT.toString());
      await helper.confirmStatus(api.poll, requestId, 'Processed');
      assert.equal(await api.query.getAvtBalance(newUser), ONE_AVT.toString());

      api = await avnGateway.apis(newUser);
      assert.equal(await canAccessTheGateway(api), true);
    });

    it('an existing user can access the gateway without AVT', async () => {
      let requestId = await api.send.transferAvt(existingUser, ONE_AVT.toString());
      await helper.confirmStatus(api.poll, requestId, 'Processed');
      assert.equal(await api.query.getAvtBalance(existingUser), ONE_AVT.toString());

      api = await avnGateway.apis(existingUser);
      const relayerFee = await api.query.getRelayerFees(relayer, helper.avt, existingUser, 'proxyTokenTransfer');
      requestId = await api.send.transferAvt(user, ONE_AVT.sub(new BN(relayerFee)).toString());
      await helper.confirmStatus(api.poll, requestId, 'Processed');

      api = await avnGateway.apis(user);
      assert.equal(await api.query.getAvtBalance(existingUser), '0'); // confirm existingUser now holds no AVT
      assert((await api.query.getUserNonce(existingUser, 'payment')) > 0);
      assert((await api.query.getUserNonce(existingUser, 'token')) > 0);

      api = await avnGateway.apis(existingUser);
      assert.equal(await canAccessTheGateway(api), true);
    });

    xit('a new split fee user can access the gateway if they have a valid payer', async () => {
      const splitFeeUser = avnGateway.accountUtils.generateNewAccount();
      await registerSplitFeeUser(splitFeeUser.publicKey);

      assert((await api.query.getUserNonce(splitFeeUser.address, 'payment')) === '0');

      const splitFeeUserBalance = new BN(await api.query.getAvtBalance(splitFeeUser.address));
      if (splitFeeUserBalance.gt(new BN(0))) {
        const relayerFee = await api.query.getRelayerFees(relayer, helper.avt, user, 'proxyTokenTransfer');
        requestId = await api.send.transferAvt(user, splitFeeUserBalance.sub(new BN(relayerFee)).toString());
      }

      assert.equal(await api.query.getAvtBalance(splitFeeUser.address), '0');
      api = await avnGateway.apis(splitFeeUser.address);
      assert.equal(await canAccessTheGateway(api), false);

      options.hasPayer = true;
      avnGateway = await helper.avnApi(options);
      api = await avnGateway.apis(splitFeeUser.address);
      assert.equal(await canAccessTheGateway(api), true);
    });
  });
});
