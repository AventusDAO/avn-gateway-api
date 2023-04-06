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

describe('Remote signer:', async () => {
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

  describe('setSigner', async () => {
    it('can set signer via the api', async () => {
      assert.equal(api.myAddress(), user);
      assert.equal(api.signer().address(), user);
      api.setSigner({
        sign: (data) => signData(data, newUserSURI),
        address: () => newUser,
      });
      assert.equal(api.myAddress(), newUser);
      assert.equal(api.signer().address(), newUser);
    });
  });

});