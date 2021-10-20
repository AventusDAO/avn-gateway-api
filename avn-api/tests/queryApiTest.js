const assert = require('chai').assert;
const helper = require('./helper.js');

describe('Query api calls:', async() => {
  let api;

  before(async () => {
    api = await helper.avnApi();
  })

  describe('getTotalAvt', async () => {

    it('returns total AVT supply', async () => {
      assert.equal(helper.AVT_SUPPLY, await api.query.getTotalAvt());
    })
  })
})