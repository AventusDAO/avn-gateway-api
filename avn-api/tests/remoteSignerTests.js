const AvnApi = require('../index.js');
const assert = require('chai').assert;
const helper = require('./helper.js');
const { u8aToHex } = require('@polkadot/util');

const accounts = helper.ACCOUNTS;
const BN = helper.BN;
const bnEquals = helper.bnEquals;
const ONE_AVT = new BN('1000000000000000000');

const { Keyring } = require('@polkadot/keyring');
const keyring = new Keyring({ type: 'sr25519', ss58Format: 42 });

function signData(data, suri) {
  const signer = keyring.addFromUri(suri);
  return signer.sign(data);
}

async function signDataAsync(data, suri) {
  const signer = keyring.addFromUri(suri);
  await new Promise(r => setTimeout(r, 2000));
  return u8aToHex(signer.sign(data));
}

async function signDataAsync_byteSignature(data, suri) {
  const signer = keyring.addFromUri(suri);
  await new Promise(r => setTimeout(r, 2000));
  return signer.sign(data);
}

describe('Remote signer:', async () => {
  let api;
  let relayer, user, userSURI, userPublicKey, newUser, newUserSURI, newUserPublicKey;

  const signer = {
    sign: async data => await signDataAsync(data, accounts.user.seed),
    address: accounts.user.address
  };

  before(async () => {
    api = await helper.avnApi({ signer });
    relayer = accounts.relayer.address;
    user = accounts.user.address;
    userSURI = accounts.user.seed;
    userPublicKey = accounts.user.publicKey;

    newUserAccount = api.utils.generateNewAccount();
    newUser = newUserAccount.address;
    newUserSURI = newUserAccount.seed;
    newUserPublicKey = newUserAccount.publicKey;
  });

  describe('setSigner', async () => {
    afterEach(async () => {
      api.setSigner(signer);
    });

    it('can set signer via the api', async () => {
      assert.equal(api.myAddress(), user);
      assert.equal(api.signer().address, user);

      api.setSigner({
        sign: data => signData(data, newUserSURI),
        address: newUser
      });
      assert.equal(api.myAddress(), newUser);
      assert.equal(api.signer().address, newUser);
    });

    it('can update my public key', async () => {
      assert.equal(userPublicKey, api.myPublicKey());

      api.setSigner({
        sign: data => signData(data, newUserSURI),
        address: newUser
      });

      assert.equal(newUserPublicKey, api.myPublicKey());
    });

    it('can update my address', async () => {
      assert.equal(user, api.myAddress());
      assert.equal(user, api.signer().address);

      api.setSigner({
        sign: data => signData(data, newUserSURI),
        address: newUser
      });

      assert.equal(newUser, api.myAddress());
      assert.equal(newUser, api.signer().address);
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

    it('can send transaction using a remote signer returning bytes signature', async () => {
      const signer = {
        sign: async data => await signDataAsync_byteSignature(data, accounts.user.seed),
        address: accounts.user.address
      };

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
