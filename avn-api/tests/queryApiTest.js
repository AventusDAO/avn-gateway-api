const chai = require('chai')
const expect = chai.expect
const assert = chai.assert
chai.use(require('chai-as-promised'))
const helper = require('./helper.js')
const accounts = helper.ACCOUNTS

describe('Query api calls:', async () => {
  let api
  let relayer, user

  const expectedRelayerFees = {
    proxyAvtTransfer: '7000000000000000',
    proxyTokenTransfer: '7000000000000000',
    proxyMintSingleNft: '7000000000000000'
  }

  const expectedUserFees = {
    proxyAvtTransfer: '7000000000000000',
    proxyTokenTransfer: '30000000000000000',
    proxyMintSingleNft: '7000000000000000'
  }

  before(async () => {
    api = await helper.avnApi()
    relayer = accounts.relayer.address
    user = accounts.sender.address
  })

  describe('getTotalAvt', async () => {
    it('returns total AVT supply', async () => {
      const { avt_supply } = require(`../config/${process.argv[6]}.json`)
      assert.equal(avt_supply, await api.query.getTotalAvt())
    })
  })

  describe('getRelayerFees', async () => {
    it('returns default fees for a relayer', async () => {
      const returnedFees = await api.query.getRelayerFees(relayer)
      assert.equal(JSON.stringify(returnedFees), JSON.stringify(expectedRelayerFees))
    })

    it('returns fees for a specific user', async () => {
      const returnedFees = await api.query.getRelayerFees(relayer, user)
      assert.equal(JSON.stringify(returnedFees), JSON.stringify(expectedUserFees))
    })

    it('returns the fee for a specific user and transaction type', async () => {
      const transactionType = 'proxyTokenTransfer'
      const returnedFees = await api.query.getRelayerFees(relayer, user, transactionType)
      assert.equal(returnedFees, expectedUserFees[transactionType])
    })

    it('errors if relayer is not registered', async () => {
      await expect(api.query.getRelayerFees(user)).to.be.rejectedWith(Error)
    })
  })
})
