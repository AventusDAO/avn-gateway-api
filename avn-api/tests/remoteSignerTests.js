const AvnApi = require('../index.js');
const assert = require('chai').assert;
const helper = require('./helper.js');
const accounts = helper.ACCOUNTS;
const BN = helper.BN;
const bnEquals = helper.bnEquals;
const ONE_AVT = new BN('1000000000000000000');

const { Keyring } = require('@polkadot/keyring');
const keyring = new Keyring({ type: 'sr25519', ss58Format: 42 });

function signData(data, suri) {
  const signer = keyring.addFromUri(suri);
  return signer.sign(data)
}

function signDataAsync(data, suri) {
  const signer = keyring.addFromUri(suri);
  return signer.sign(data)
}

describe('Remote signer:', async () => {
  let api;
  let relayer, user, userSURI, newUser, newUserSURI;

  const signer = {
    sign: (data) => signData(data, accounts.user.seed),
    address: () => accounts.user.address,
  }

  before(async () => {
    api = await helper.avnApi({signer});
    relayer = accounts.relayer.address;
    user = accounts.user.address;
    userSURI = accounts.user.seed;

    newUserAccount = api.utils.generateNewAccount();
    newUser = newUserAccount.address;
    newUserSURI = newUserAccount.seed;
  });

  describe('setSigner', async () => {
    afterEach(async () => {
      api.setSigner(signer);
    });

    it('can set signer via the api', async () => {
      assert.equal(api.myAddress(), user);
      assert.equal(api.signer().address(), user);

      api.setSigner({
        sign: data => signData(data, newUserSURI),
        address: () => newUser,
      });
      assert.equal(api.myAddress(), newUser);
      assert.equal(api.signer().address(), newUser);
    });

    it('can set async signer via the api', async () => {
      assert.equal(api.myAddress(), user);
      assert.equal(api.signer().address(), user);

      api.setSigner({
        sign: async data => await signDataAsync(data, newUserSURI),
        address: () => newUser,
      });
      assert.equal(api.myAddress(), newUser);
      assert.equal(api.signer().address(), newUser);
    });
  });

  describe('awtGeneration', async () => {
    it('generates a valid token for self pay users', async () => {
      let options = {
        relayer: relayer,
        hasPayer: false,
        payer: undefined,
        signer
      };

      let apiWithOptions = await helper.avnApi(options);
      assert((await apiWithOptions.query.getAvtContractAddress()).length == 42);
    });

    it('generates a valid token for split fee users', async () => {
      let options = {
        relayer: relayer,
        hasPayer: true,
        payer: undefined,
        signer
      };

      let apiWithOptions = await helper.avnApi(options);
      assert((await apiWithOptions.query.getAvtContractAddress()).length == 42);
    });
  });

  describe('transactionSending', async () => {
    it('can send transaction using a remote signer', async () => {
      let options = {
        relayer: relayer,
        signer
      };

      let apiWithOptions = await helper.avnApi(options);
      const requestId = await apiWithOptions.send.transferAvt(accounts.otherUser.address, 1);
      await helper.confirmStatus(apiWithOptions, requestId, 'Processed');
    });
  });

});