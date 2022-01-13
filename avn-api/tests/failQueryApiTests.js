const chai = require('chai')
const expect = chai.expect
const assert = chai.assert

describe('Fail Query api calls:', async () => {

  before(async () => {
    //set up params
  })

  beforeEach(async () => {
    //reset state for isolation of tests
  })

  describe('getTokenBalance', async () => {
    //getTokenBalance(account, token_address)
    it('With a valid account and a bad token')
    it('With a bad account and a valid token')
    it('With a bad account and a bad account')
  })

  describe('getAccountNonce', async () => {
    //getAccountNonce(account)
    it('With a bad account')
  })

  describe('getAccountPaymentNonce', async () => {
    //getAccountPaymentNonce(account)
    it('With a bad account')
  })

  describe('getAvtContractAddress', async () => {
    //getAvtContractAddress(avnApi)
    it('With a bad api')
  })

  describe('getRelayerFees', async () => {
    //getRelayerFees(avnRelayerAddress);
    //getRelayerFees(avnRelayerAddress, user);
    //getRelayerFees(avnRelayerAddress, user, _transaction_type);
    it('With a bad address')
    it('With a valid address with a bad user')
    it('With a bad address with a valid user')
    it('With a bad address and a bad user')
    it('With a valid address, a valid user and a bad transaction type')
    it('With a valid address, a bad user and a valid transaction type')
    it('With a bad address, a valid user and a valid transaction type')
    it('With a bad address, a bad user and a valid transaction type')
    it('With a bad address, a bad user and a bad transaction type')
  })

  describe('getNftNonce', async () => {
    //getNftNonce(nftId)
    it('With a bad nft id')
  })

  describe('getNftId', async () => {
    //getNftId(external_reference);
    it('With a bad external reference')
  })

  describe('getNftOwner', async () => {
    //getNftOwner(nftId)
    it('With a bad nft id')
  })
})
