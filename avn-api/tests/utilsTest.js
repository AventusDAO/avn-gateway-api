const assert = require('chai').assert
const helper = require('./helper.js')

describe('AWT authorisation', async () => {
  let api

  before(async () => {
    api = await helper.avnApi()
  })

  describe('generateAccount', async () => {
    it('can generate a new account', async () => {
      const account = api.utils.generateNewAccount()
      console.log(account)
    })
  })
})
