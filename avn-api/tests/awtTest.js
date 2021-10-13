const assert = require('chai').assert;
const helper = require('./helper.js');
const accounts = helper.ACCOUNTS;

const TOKEN_LENGTH = 332;
const TOKEN_LIFETIME = 30000;

describe('AWT Tokens', async() => {
  let api;
  let user;

  before(async () => {
    api = await helper.avnApi();
    user = accounts.suri;
  })

  describe('can generate a token', async () => {

    it('from a mnemonic', async () => {
      let token = api.awt.generateAwtToken(user.mnemonic);
      assert.equal(token.split('').length, TOKEN_LENGTH);
    })

    it('from a seed', async () => {
      let token = api.awt.generateAwtToken(user.seed);
      assert.equal(token.split('').length, TOKEN_LENGTH);
    })
  })

  describe('check token validity', async () => {
    let token;

    before(async () => {
      token = api.awt.generateAwtToken(user.mnemonic);
    })

    it('is valid within lifetime', async () => {
      assert.equal(api.awt.tokenAgeIsValid(token), true);
    })

    it('is invalid once lifetime has passed', async () => {
      await helper.sleep(TOKEN_LIFETIME)
      assert.equal(api.awt.tokenAgeIsValid(token), false);
    })
  })
})