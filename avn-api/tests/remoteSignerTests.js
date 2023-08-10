const {AvnApi, SetupMode, SigningMode, NonceCacheType} = require('avn-api');
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
  let avnApi, api, newApi;
  let relayer, user, userPublicKey, newUser, newUserPublicKey;

  const signer = {
    sign: async (data, signerAddress) => await signDataAsync(data, signerAddress),
    address: accounts.user.address
  };

  before(async () => {
    avnApi = await helper.avnApi({
      setupMode : SetupMode.MultiUser,
      signingMode: SigningMode.RemoteSigner,
      signer
    });
    api = await avnApi.apis(accounts.user.address);
    relayer = accounts.relayer.address;
    user = accounts.user.address;
    userPublicKey = accounts.user.publicKey;

    newUserAccount = avnApi.accountUtils.generateNewAccount();
    newUser = newUserAccount.address;
    newUserPublicKey = newUserAccount.publicKey;
    accounts["newUser"] = newUserAccount;
  });

  describe('Change signer', async () => {
    before(async () => {
      api = await avnApi.apis(user);
    });

    it('can set signer via the api and update the signer address', async () => {
      assert.equal(api.query.awtManager.signerAddress, user);
      api = await avnApi.apis(newUser);
      assert.equal(api.query.awtManager.signerAddress, newUser);
    });
  });

  describe('awtGeneration', async () => {
    it('generates a valid token for self pay users', async () => {
      let options = {
        setupMode : SetupMode.MultiUser,
        signingMode: SigningMode.RemoteSigner,
        relayer: relayer,
        hasPayer: false,
        payer: undefined,
        signer
      };

      let apiWithOptions = await helper.avnApi(options);
      newApi = await apiWithOptions.apis(user);
      assert((await newApi.query.getAvtContractAddress()).length == 42);
    });

    it('generates a valid token for split fee users', async () => {
      let options = {
        setupMode : SetupMode.MultiUser,
        signingMode: SigningMode.RemoteSigner,
        relayer: relayer,
        hasPayer: true,
        payer: undefined,
        signer
      };

      let apiWithOptions = await helper.avnApi(options);
      newApi = await apiWithOptions.apis(user);
      assert((await newApi.query.getAvtContractAddress()).length == 42);
    });
  });

  describe('transactionSending', async () => {
    it('can send transaction using a remote signer', async () => {
      let options = {
        setupMode : SetupMode.MultiUser,
        signingMode: SigningMode.RemoteSigner,
        relayer: relayer,
        signer
      };

      let apiWithOptions = await helper.avnApi(options);
      newApi = await apiWithOptions.apis(user);
      const requestId = await newApi.send.transferAvt(accounts.otherUser.address, 1);
      await helper.confirmStatus(newApi.poll, requestId, 'Processed');
    });

    it('can send transaction using a remote signer returning bytes signature', async () => {
      const signer = {
        sign: async (data, signerAddress) => await signDataAsync_byteSignature(data, signerAddress),
        address: accounts.user.address
      };

      let options = {
        setupMode : SetupMode.MultiUser,
        signingMode: SigningMode.RemoteSigner,
        relayer: relayer,
        signer
      };

      let apiWithOptions = await helper.avnApi(options);
      newApi = await apiWithOptions.apis(user);
      const requestId = await newApi.send.transferAvt(accounts.otherUser.address, 1);
      await helper.confirmStatus(newApi.poll, requestId, 'Processed');
    });

    it('can send transaction after setting a new remote signer', async () => {
      const signer = {
        sign: (data, signerAddress) => signDataAsync(data, signerAddress),
        address: accounts.newUser.address
      };

      let options = {
        setupMode : SetupMode.MultiUser,
        signingMode: SigningMode.RemoteSigner,
        relayer: relayer,
        signer
      };

      let apiWithOptions = await helper.avnApi(options);
      newApi = await apiWithOptions.apis(user);

      const requestId = await newApi.send.transferAvt(accounts.otherUser.address, 1);
      await helper.confirmStatus(newApi.poll, requestId, 'Processed');
    });
  });
});
