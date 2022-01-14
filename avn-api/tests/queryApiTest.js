const chai = require('chai')
const expect = chai.expect
const assert = chai.assert
chai.use(require('chai-as-promised'))
const helper = require('./helper.js')
const accounts = helper.ACCOUNTS
const BN = helper.BN

const MIN_TOTAL_AVT_SUPPLY = new BN('100000000000000000000')

describe('Query api calls:', async () => {
  let api
  let relayer, user
  let relayerPublicKey, userPublicKey

  const expectedRelayerFees = {
    proxyAvtTransfer: '7000000000000000',
    proxyTokenTransfer: '7000000000000000',
    proxyMintSingleNft: '7000000000000000',
    proxyListNftOpenForSale: '7000000000000000',
    proxyTransferFiatNft: '7000000000000000',
    proxyCancelListFiatNft: '7000000000000000'
  }

  const expectedUserFees = {
    proxyAvtTransfer: '7000000000000000',
    proxyTokenTransfer: '30000000000000000',
    proxyMintSingleNft: '7000000000000000',
    proxyListNftOpenForSale: '7000000000000000',
    proxyTransferFiatNft: '7000000000000000',
    proxyCancelListFiatNft: '7000000000000000'
  }

  before(async () => {
    api = await helper.avnApi()
    relayer = accounts.relayer.address
    user = accounts.sender.address
    relayerPublicKey = accounts.relayer.publicKey
    userPublicKey = accounts.sender.publicKey
  })

  describe('getTotalAvt', async () => {
    it('returns total AVT supply', async () => {
      assert(new BN(await api.query.getTotalAvt()).gt(MIN_TOTAL_AVT_SUPPLY))
    })
  })

  describe('getRelayerFees', async () => {
    it('returns default fees for a relayer by address', async () => {
      const returnedFees = await api.query.getRelayerFees(relayer)
      assert.equal(JSON.stringify(returnedFees), JSON.stringify(expectedRelayerFees))
    })

    it('returns default fees for a relayer by publicKey', async () => {
      const returnedFees = await api.query.getRelayerFees(relayerPublicKey)
      assert.equal(JSON.stringify(returnedFees), JSON.stringify(expectedRelayerFees))
    })

    it('returns fees for a specific user by address', async () => {
      const returnedFees = await api.query.getRelayerFees(relayer, user)
      assert.equal(JSON.stringify(returnedFees), JSON.stringify(expectedUserFees))
    })

    it('returns fees for a specific user by publicKey', async () => {
      const returnedFees = await api.query.getRelayerFees(relayer, userPublicKey)
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

  describe('getAvtBalance', async () => {
  //getAvtBalance(account)
    it('returns correct avt balance for specific user by address')
    it('returns correct avt balance for specific user by publicKey')
  })
  describe('getTokenBalance', async () => {
  //getTokenBalance(account, token_address)
    it('returns correct token balance for specific user by address')
    it('returns correct token balance for specific user by publicKey')
  })
  describe('getAccountNonce', async () => {
  //getAccountNonce(account)
    it('returns correct account nonce for specific user by address')
    it('returns correct account nonce for specific user by publicKey')
  })
  describe('getAccountPaymentNonce', async () => {
  //getAccountPaymentNonce(account)
    it('returns correct account payment nonce for specific user by address')
    it('returns correct account payment nonce for specific user by publicKey')
  })
  describe('getAvtContractAddress', async () => {
  //getAvtContractAddress()
    it('returns correct avt contract address')
  })
  describe('getNftNonce', async () => {
  //getNftNonce(nftId)
    it('returns correct nft nonce for specific nft id')
  })
  describe('getNftId', async () => {
  //getNftId(external_reference);
    it('returns correct nft id for specific reference')
  })
  describe('getNftOwner', async () => {
  //getNftOwner(nftId)
    it('returns correct nft owner for specific nft id')
  })
})
