const assert = require('chai').assert
const helper = require('./helper.js')
const accounts = helper.ACCOUNTS

describe('Query api calls:', async () => {
  let api
  let relayer, user

  const expectedDefaultFees = {
    proxyAvtTransfer: '1000000000000000',
    proxyTokenTransfer: '1000000000000000'
  }

  const expectedUserFees = {
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
    it('returns default fees for a relayer', async () => {
      const returnedFees = await api.query.getRelayerFees(relayer)
      assert.equal(JSON.stringify(returnedFees), JSON.stringify(expectedDefaultFees))
    })

    it('returns fees for a specific user', async () => {
      const returnedFees = await api.query.getRelayerFees(relayer, user)
      assert.equal(JSON.stringify(returnedFees), JSON.stringify(expectedUserFees))
    })
    xit('returns the fee for a specific user and transaction type', async () => {
      const transactionType = 'proxyAvtTransfer'
      const returnedFees = await api.query.getRelayerFees(relayer, user, transactionType)
      assert.equal(returnedFees, expectedUserFees[transactionType])
    })
  })
})
