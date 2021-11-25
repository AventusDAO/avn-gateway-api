const assert = require('chai').assert
const helper = require('./helper.js')

describe('Query api calls:', async () => {
  let api
  let relayer, user

  before(async () => {
    api = await helper.avnApi()
    relayer = accounts.relayer.address
    user = accounts.sender.address
  })

  describe('getTotalAvt', async () => {
    it('returns total AVT supply', async () => {
      assert.equal(helper.AVT_SUPPLY, await api.query.getTotalAvt())
    })
  })

  describe('getRelayerFees', async () => {
    it('returns relayer fees for a user', async () => {
      console.log(await api.query.getRelayerFees(relayer, user))
    })
    it('returns the relayer fee for a user for a transaction type', async () => {
      console.log(await api.query.getRelayerFees(relayer, user, 'proxyAvtTransfer'))
    })
  })
})
