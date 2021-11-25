const assert = require('chai').assert
const helper = require('./helper.js')
const accounts = helper.ACCOUNTS

describe('Query api calls:', async () => {
  let api
  let relayer, user

  let expectedFees = {
    proxyAvtTransfer: '1000000000000000',
    proxyTokenTransfer: '1000000000000000'
  }

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
      const returnedFees = await api.query.getRelayerFees(relayer, user)
      assert.equal(JSON.stringify(returnedFees), JSON.stringify(expectedFees))
    })
    xit('returns the relayer fee for a user for a transaction type', async () => {
      const txType = 'proxyAvtTransfer'
      const returnedFees = await api.query.getRelayerFees(relayer, user, txType)
      assert.equal(returnedFees, expectedFees[txType])
    })
  })
})
