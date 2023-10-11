const assert = require('chai').assert;
const helper = require('./helper.js');
const accounts = helper.ACCOUNTS;

const TOKEN_LENGTH = 352;
const TOKEN_LIFETIME = 600000;

describe('AWT authorisation', async () => {
  let avnApi, api;
  let user, relayer;

  before(async () => {
    avnApi = await helper.avnApi({
      suri: accounts.user.seed
    });
    api = await avnApi.apis();
    user = accounts.user;
    relayer = accounts.relayer.address;
  });

  describe('generateAwtToken', async () => {
    it('from a mnemonic', async () => {
      let token = await avnApi.awtUtils.generateAwtToken({ suri: user.mnemonic }, avnApi.signer);
      assert.equal(token.split('').length, TOKEN_LENGTH);
    });

    it('from a seed', async () => {
      let token = await avnApi.awtUtils.generateAwtToken({ suri: user.seed }, avnApi.signer);
      assert.equal(token.split('').length, TOKEN_LENGTH);
    });
  });

  describe('tokenAgeIsValid', async () => {
    let token;

    before(async () => {
      token = await avnApi.awtUtils.generateAwtToken({ suri: user.mnemonic }, avnApi.signer);
    });

    it('is valid within its lifetime', async () => {
      assert.equal(avnApi.awtUtils.tokenAgeIsValid(token), true);
    });

    xit('is invalid once lifetime expires', async () => {
      // We should not skip this otherwise we forget to run it
      await helper.sleep(TOKEN_LIFETIME);
      assert.equal(avnApi.awtUtils.tokenAgeIsValid(token), false);
    });
  });

  describe('splitFeeOptions', async () => {
    let apiWithOptions, newApi;
    it('generates a valid token for self pay users', async () => {
      let options = {
        suri: accounts.user.seed,
        relayer: relayer,
        hasPayer: false,
        payer: undefined
      };

      apiWithOptions = await helper.avnApi(options);
      newApi = await apiWithOptions.apis();
      assert((await newApi.query.getAvtContractAddress()).length == 42);
    });

    it('generates a valid token for split fee users', async () => {
      let options = {
        suri: accounts.user.seed,
        relayer: relayer,
        hasPayer: true,
        payer: undefined
      };

      apiWithOptions = await helper.avnApi(options);
      newApi = await apiWithOptions.apis();
      assert((await newApi.query.getAvtContractAddress()).length == 42);
    });

    it('generates a valid token for split fee users with a specific payer address', async () => {
      let options = {
        suri: accounts.user.seed,
        relayer: relayer,
        hasPayer: true,
        payer: '5FbUQ2kJWLoqHuSTSNNqBwKwdQnBVe4HF3TeGyu6UoZaryTh'
      };

      apiWithOptions = await helper.avnApi(options);
      newApi = await apiWithOptions.apis();
      assert((await newApi.query.getAvtContractAddress()).length == 42);
    });

    it('generates a valid token for split fee users with a specific payer public key', async () => {
      let options = {
        suri: accounts.user.seed,
        relayer: relayer,
        hasPayer: true,
        payer: '0x9c2bfffc466eb9c1bad0d8393df93770468ee54b0a0f05232e4b5dde6960b004'
      };

      apiWithOptions = await helper.avnApi(options);
      newApi = await apiWithOptions.apis();
      assert((await newApi.query.getAvtContractAddress()).length == 42);
    });

    it('generates a valid token for legacy (pre-splitFee) users', async () => {
      // If hasPayer is not specified, we assume it is a selfPay user
      let options = {
        suri: accounts.user.seed,
      };

      apiWithOptions = await helper.avnApi(options);
      newApi = await apiWithOptions.apis();
      assert((await newApi.query.getAvtContractAddress()).length == 42);
    });
  });
});
