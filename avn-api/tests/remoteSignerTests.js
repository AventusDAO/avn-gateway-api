const assert = require('chai').assert;
const helper = require('./helper.js');
const { u8aToHex } = require('@polkadot/util');

const accounts = helper.ACCOUNTS;
const BN = helper.BN;
const bnEquals = helper.bnEquals;
const ONE_AVT = new BN('1000000000000000000');

const { Keyring } = require('@polkadot/keyring');
const keyring = new Keyring({ type: 'sr25519', ss58Format: 42 });

function getUserSeedFromAddress(userAddress) {
  return Object.keys(accounts).flatMap(a => accounts[a].address === userAddress ? [accounts[a].seed] : [])[0]
}

function signData(data, signerAddress) {
  const signerSuri = getUserSeedFromAddress(signerAddress);
  const signer = keyring.addFromUri(signerSuri);
  return signer.sign(data);
}

async function signDataAsync(data, signerAddress) {
  const signerSuri = getUserSeedFromAddress(signerAddress);
  const signer = keyring.addFromUri(signerSuri);
  await new Promise(r => setTimeout(r, 2000));
  return u8aToHex(signer.sign(data));
}

async function signDataAsync_byteSignature(data, signerAddress) {
  const signerSuri = getUserSeedFromAddress(signerAddress);
  const signer = keyring.addFromUri(signerSuri);
  await new Promise(r => setTimeout(r, 2000));
  return signer.sign(data);
}

describe('Remote signer:', async () => {
  let api;
  let relayer, user, userPublicKey, newUser, newUserPublicKey;

  const signer = {
    sign: async (data, signerAddress) => await signDataAsync(data, signerAddress),
    address: accounts.user.address
  };

  before(async () => {
    api = await helper.avnApi({ signer });
    relayer = accounts.relayer.address;
    user = accounts.user.address;
    userPublicKey = accounts.user.publicKey;

    newUserAccount = api.accountUtils.generateNewAccount();
    newUser = newUserAccount.address;
    newUserPublicKey = newUserAccount.publicKey;
    accounts["newUser"] = newUserAccount;
  });

  describe('setSigner', async () => {
    afterEach(async () => {
      await api.setSigner(signer);
    });

    it('can set signer via the api', async () => {
      assert.equal(api.myAddress(), user);
      assert.equal(api.signer().address, user);

      await api.setSigner({
        sign: (data, signerAddress) => signData(data, signerAddress),
        address: newUser
      });
      assert.equal(api.myAddress(), newUser);
      assert.equal(api.signer().address, newUser);
    });

    it('can update my public key', async () => {
      assert.equal(userPublicKey, api.myPublicKey());

      await api.setSigner({
        sign: (data, signerAddress) => signData(data, signerAddress),
        address: newUser
      });

      assert.equal(newUserPublicKey, api.myPublicKey());
    });

    it('can update my address', async () => {
      assert.equal(user, api.myAddress());
      assert.equal(user, api.signer().address);

      await api.setSigner({
        sign: (data, signerAddress) => signData(data, signerAddress),
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
        sign: async (data, signerAddress) => await signDataAsync_byteSignature(data, signerAddress),
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

    it('can send transaction after setting a new remote signer', async () => {
      const signer = {
        sign: (data, signerAddress) => signDataAsync(data, signerAddress),
        address: accounts.newUser.address
      };

      let options = {
        relayer: relayer,
        signer
      };

      let apiWithOptions = await helper.avnApi(options);

      await apiWithOptions.setSigner({
        sign: (data, signerAddress) => signData(data, signerAddress),
        address: accounts.user.address
      });

      const requestId = await apiWithOptions.send.transferAvt(accounts.otherUser.address, 1);
      await helper.confirmStatus(apiWithOptions, requestId, 'Processed');
    });
  });
});
