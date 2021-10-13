const assert = require('chai').assert;
const helper = require('./helper.js');

describe('SendTx api calls:', async() => {
  let api;

  before(async () => {
    api = await helper.avnApi();
  })

  describe('getTotalAvt', async () => {

    it('gets total AVT', async () => {
      assert.equal(helper.AVT_SUPPLY, await api.query.getTotalAvt());
    })
  })
})