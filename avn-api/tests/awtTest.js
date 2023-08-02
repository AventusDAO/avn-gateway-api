const assert = require('chai').assert;
const helper = require('./helper.js');
const accounts = helper.ACCOUNTS;

const TOKEN_LENGTH = 352;
const TOKEN_LIFETIME = 600000;

describe('AWT authorisation', async () => {
  let api, relayer;

  before(async () => {
    api = await helper.avnApi({
      suri: accounts.user.seed
    });

    relayer = accounts.relayer.address;
  });

  describe('generateAwtToken', async () => {
    it('can generate an awt token', async () => {
      let token = await api.awtUtils.generateAwtToken({}, api.signer);
      assert.equal(token.split('').length, TOKEN_LENGTH);
    });
  });

  describe('tokenAgeIsValid', async () => {
    let token;

    before(async () => {
      token = await api.awtUtils.generateAwtToken({}, api.signer);
    });

    it('is valid within its lifetime', async () => {
      assert.equal(api.awtUtils.tokenAgeIsValid(token), true);
    });

    it('is invalid once lifetime expires', async () => {
      // We should not skip this otherwise we forget to run it
      await helper.sleep(TOKEN_LIFETIME);
      assert.equal(api.awtUtils.tokenAgeIsValid(token), false);
    });
  });

  describe('splitFeeOptions', async () => {
    it('generates a valid token for self pay users', async () => {
      let options = {
        relayer: relayer,
        hasPayer: false,
        payer: undefined,
        suri: accounts.user.seed
      };

      let apiWithOptions = (await helper.avnApi(options)).apis();
      assert((await apiWithOptions.query.getAvtContractAddress()).length == 42);
    });

    it('generates a valid token for split fee users', async () => {
      let options = {
        relayer: relayer,
        hasPayer: true,
        payer: undefined,
        suri: accounts.user.seed
      };

      let apiWithOptions = (await helper.avnApi(options)).apis();
      assert((await apiWithOptions.query.getAvtContractAddress()).length == 42);
    });

    it('generates a valid token for split fee users with a specific payer address', async () => {
      let options = {
        relayer: relayer,
        hasPayer: true,
        payer: '5FbUQ2kJWLoqHuSTSNNqBwKwdQnBVe4HF3TeGyu6UoZaryTh',
        suri: accounts.user.seed
      };

      let apiWithOptions = (await helper.avnApi(options)).apis();
      assert((await apiWithOptions.query.getAvtContractAddress()).length == 42);
    });

    it('generates a valid token for split fee users with a specific payer public key', async () => {
      let options = {
        relayer: relayer,
        hasPayer: true,
        payer: '0x9c2bfffc466eb9c1bad0d8393df93770468ee54b0a0f05232e4b5dde6960b004',
        suri: accounts.user.seed
      };

      let apiWithOptions = (await helper.avnApi(options)).apis();
      assert((await apiWithOptions.query.getAvtContractAddress()).length == 42);
    });

    it('generates a valid token for legacy (pre-splitFee) users', async () => {
      // If hasPayer is not specified, we assume it is a selfPay user
      let options = {
        suri: accounts.user.seed
      };

      let apiWithOptions = (await helper.avnApi(options)).apis();
      assert((await apiWithOptions.query.getAvtContractAddress()).length == 42);
    });
  });
});
