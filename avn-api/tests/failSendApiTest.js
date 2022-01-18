const chai = require('chai')
const expect = chai.expect
const assert = chai.assert

describe('Fail Send api calls:', async () => {

  before(async () => {
    //set up params
  })

  beforeEach(async () => {
    //reset state for isolation of tests
  })

  describe('transferAvt', async () => {
    //transferAvt(relayer, recipient, amount)
    describe('fails when called', async () => {
      it('With amount greater than senders balance')
      it('With amount as undefined')
      it('With amount as zero')
      it('With amount as negative value')
      it('With amount not being a number')

      it('With relayer as empty string')
      it('With relayer as undefined')
      it('With relayer in invalid format')
      it('With relayer address short')
      it('With relayer address long')
      it('With relayer address that is not a relayer')

      it('With sender and recipient as the same address')

      it('With recipient as empty string')
      it('With recipient as undefined')
      it('With recipient in invalid format')
      it('With recipient address short')
      it('With recipient address long')

    })
  })

  describe('transferToken', async () => {
    //transferToken(relayer, recipient, token, amount)
    describe('fails when called', async () => {
      it('With token amount greater than senders token balance')
      it('With token amount as undefined')
      it('With token amount as zero')
      it('With token amount as negative value')
      it('With token amount not being a number')

      it('With relayer as empty string')
      it('With relayer as undefined')
      it('With relayer in invalid format')
      it('With relayer address short')
      it('With relayer address long')
      it('With relayer address that is not a relayer')

      it('With sender and recipient as the same address')

      it('With recipient as empty string')
      it('With recipient as undefined')
      it('With recipient in invalid format')
      it('With recipient address short')
      it('With recipient address long')

      it('With token as empty string')
      it('With token as undefined')
      it('With token in invalid format')
      it('With token that doesnt exist')

    })
  })

  describe('mintSingleNft', async () => {
    //mintSingleNft(relayer, externalRef, royalties, T1Authority)
    describe('fails when called', async () => {
      it('With relayer as empty string')
      it('With relayer as undefined')
      it('With relayer in invalid format')
      it('With relayer address short')
      it('With relayer address long')
      it('With relayer address that is not a relayer')

      it('With external reference as empty string')
      it('With external reference as undefined')
      it('With external reference in invalid format')
      it('With external reference in valid format but not existent')

      it('With royalties as undefined')
      it('With royalties with invalid JSON format')

      it('With royalties where recipient address is empty string')
      it('With royalties where recipient address is undefined')
      it('With royalties where recipient address is in invalid format')
      it('With royalties where recipient address is short')
      it('With royalties where recipient address is long')

      it('With royalties where parts_per_million not a number')
      it('With royalties where parts_per_million is zero')
      it('With royalties where parts_per_million is not integer')
      it('With royalties where parts_per_million is bigger than 1,000,000')
      it('With royalties where parts_per_million is undefined')

      it('With multiple royalties where one of them is invalid')

      it('With T1Authority as empty string')
      it('With T1Authority as undefined')
      it('With T1Authority in invalid format')
      it('With T1Authority address short')
      it('With T1Authority address long')
    })
  })

  describe('listFiatNftForSale', async () => {
    //listFiatNftForSale(relayer, nftId)
    describe('fails when called', async () => {
      it('With relayer as empty string')
      it('With relayer as undefined')
      it('With relayer in invalid format')
      it('With relayer address short')
      it('With relayer address long')
      it('With relayer address that is not a relayer')

      it('With sender that doesnt own this nft')

      it('With nft id as empty string')
      it('With nft id as undefined')
      it('With nft id that doesnt exist')
    })
  })

  describe('transferFiatNft', async () => {
    //transferFiatNft(relayer, recipient, nftId)
    describe('fails when called', async () => {
      it('With relayer as empty string')
      it('With relayer as undefined')
      it('With relayer in invalid format')
      it('With relayer address short')
      it('With relayer address long')
      it('With relayer address that is not a relayer')

      it('With sender that doesnt own this nft')
      it('With sender and recipient as the same address')

      it('With recipient as empty string')
      it('With recipient as undefined')
      it('With recipient in invalid format')
      it('With recipient address short')
      it('With recipient address long')

      it('With nft id as empty string')
      it('With nft id as undefined')
      it('With nft id that doesnt exist')
    })
  })

  describe('cancelFiatNftListing', async () => {
    //cancelFiatNftListing(relayer, nftId)
    describe('fails when called', async () => {
      it('With relayer as empty string')
      it('With relayer as undefined')
      it('With relayer in invalid format')
      it('With relayer address short')
      it('With relayer address long')
      it('With relayer address that is not a relayer')

      it('With sender that doesnt own this nft')

      it('With nft id as empty string')
      it('With nft id as undefined')
      it('With nft id that doesnt exist')
    })
  })
})
