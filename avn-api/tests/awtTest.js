const assert = require('chai').assert;
const helper = require('./helper.js');
const accounts = helper.ACCOUNTS;

const TOKEN_LENGTH = 352;
const TOKEN_LIFETIME = 60000;

describe('AWT authorisation', async () => {
  let api;
  let user;

  before(async () => {
    api = await helper.avnApi();
    user = accounts.user;
  });

  describe('generateAwtToken', async () => {
    it('from a mnemonic', async () => {
      let token = api.awt.generateAwtToken({suri: user.mnemonic});
      assert.equal(token.split('').length, TOKEN_LENGTH);
    });

    it('from a seed', async () => {
      let token = api.awt.generateAwtToken({suri: user.seed});
      assert.equal(token.split('').length, TOKEN_LENGTH);
    });
  });

  describe('tokenAgeIsValid', async () => {
    let token;

    before(async () => {
      token = api.awt.generateAwtToken({suri: user.mnemonic});
    });

    it('is valid within its lifetime', async () => {
      assert.equal(api.awt.tokenAgeIsValid(token), true);
    });

    it('is invalid once lifetime expires', async () => {
      // Skip since it takes so long to run
      await helper.sleep(TOKEN_LIFETIME);
      assert.equal(api.awt.tokenAgeIsValid(token), false);
    });
  });

  describe('splitFeeOptions', async () => {

    it('generates a valid token for self pay users', async () => {
      let options = {
        hasPayer: false,
        payer: undefined
      };

      let apiWithoptions = await helper.avnApi(options);
      assert((await apiWithoptions.query.getAvtContractAddress()).length == 42);
    });

    it('generates a valid token for split fee users', async () => {
      let options = {
        hasPayer: true,
        payer: undefined
      };

      let apiWithoptions = await helper.avnApi(options);
      assert((await apiWithoptions.query.getAvtContractAddress()).length == 42);
    });

    it('generates a valid token for split fee users with a specific payer address', async () => {
      let options = {
        hasPayer: true,
        payer: '5FbUQ2kJWLoqHuSTSNNqBwKwdQnBVe4HF3TeGyu6UoZaryTh'
      };

      let apiWithoptions = await helper.avnApi(options);
      assert((await apiWithoptions.query.getAvtContractAddress()).length == 42);
    });

    it('generates a valid token for split fee users with a specific payer public key', async () => {
      let options = {
        hasPayer: true,
        payer: '0x9c2bfffc466eb9c1bad0d8393df93770468ee54b0a0f05232e4b5dde6960b004'
      };

      let apiWithoptions = await helper.avnApi(options);
      assert((await apiWithoptions.query.getAvtContractAddress()).length == 42);
    });

    it('generates a valid token for legacy (pre-splitFee) users', async () => {
      // If hasPayer is not specified, we assume it is a selfPay user
      let options = undefined;

      let apiWithoptions = await helper.avnApi(options);
      assert((await apiWithoptions.query.getAvtContractAddress()).length == 42);
    });

  });

});
