const chai = require('chai')
const expect = chai.expect
const assert = chai.assert
const testPatterns = require('./testPatterns.js')

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
      describe('With invalid account: relayer', async () => {
        await testPatterns.validAccount('Relayer', 'accountAddress', 'validCallData');
      })
      describe('With invalid account: recipient', async () => {
        await testPatterns.validAccount('Recipient', 'accountAddress', 'validCallData');
      })
      describe('With invalid amount', async () => {
        await testPatterns.validAmount('AVT Amount', 'amountValue', 'avt', 'validCallData');
      })
      it('With relayer address that is not a relayer')
      it('With relayer address that does not have enough AVT')
      it('With API sender and recipient as the same address')
    })
  })

  describe('transferToken', async () => {
    //transferToken(relayer, recipient, token, amount)
    describe('fails when called', async () => {
      describe('With invalid account: relayer', async () => {
        await testPatterns.validAccount('Relayer', 'accountAddress', 'validCallData');
      })
      describe('With invalid account: recipient', async () => {
        await testPatterns.validAccount('Recipient', 'accountAddress', 'validCallData');
      })
      describe('With invalid token', async () => {
        await testPatterns.validEthereumToken('Token', 'accountAddress', 'validCallData');
      })
      describe('With invalid token amount', async () => {
        await testPatterns.validAmount('Token amount', 'amountValue', 'tokenAddress', 'validCallData');
      })
      it('With relayer address that is not a relayer')
      it('With relayer address that does not have enough AVT')
      it('With API sender and recipient as the same address')
    })
  })

  describe('mintSingleNft', async () => {
    //mintSingleNft(relayer, externalRef, royalties, T1Authority)
    describe('fails when called', async () => {
      describe('With invalid account: relayer', async () => {
        await testPatterns.validAccount('Relayer', 'accountAddress', 'validCallData');
      })
      describe('With invalid account: T1Authority', async () => {
        await testPatterns.validAccount('T1Authority', 'accountAddress', 'validCallData');
      })
      describe('With invalid token', async () => {
        await testPatterns.validEthereumToken('Token', 'tokenAddress', 'validCallData');
      })
      describe('With invalid token amount', async () => {
        await testPatterns.validAmount('Token Amount', 'accountAddress', 'tokenAddress', 'validCallData');
      })
      describe('With invalid external reference', async () => {
        await testPatterns.validExternalReference('External reference', 'externalRefAddress', 'validCallData');
      })

      it('With relayer address that is not a relayer')
      it('With relayer address that does not have enough AVT')

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
    })
  })

  describe('listFiatNftForSale', async () => {
    //listFiatNftForSale(relayer, nftId)
    describe('fails when called', async () => {
      describe('With invalid account: relayer', async () => {
        await testPatterns.validAccount('Relayer', 'accountAddress', 'validCallData');
      })
      describe('With invalid nft id', async () => {
        await testPatterns.validNftId('Nft id', 'nftId', 'validCallData');
      })
      it('With relayer address that is not a relayer')
      it('With relayer address that does not have enough AVT')

      it('With sender that doesnt own this nft')
    })
  })

  describe('transferFiatNft', async () => {
    //transferFiatNft(relayer, recipient, nftId)
    describe('fails when called', async () => {
      describe('With invalid account: relayer', async () => {
        await testPatterns.validAccount('Relayer', 'accountAddress', 'validCallData');
      })
      describe('With invalid account: recipient', async () => {
        await testPatterns.validAccount('Recipient', 'accountAddress', 'validCallData');
      })
      describe('With invalid nft id', async () => {
        await testPatterns.validNftId('Nft id', 'nftId', 'validCallData');
      })
      it('With sender and recipient as the same address')
      it('With sender that doesnt own this nft')

      it('With relayer address that is not a relayer')
      it('With relayer address that does not have enough AVT')
    })
  })

  describe('cancelFiatNftListing', async () => {
    //cancelFiatNftListing(relayer, nftId)
    describe('fails when called', async () => {
      describe('With invalid account: relayer', async () => {
        await testPatterns.validAccount('Relayer', 'accountAddress', 'validCallData');
      })
      describe('With invalid nft id', async () => {
        await testPatterns.validNftId('Nft id', 'nftId', 'validCallData');
      })
      it('With relayer address that is not a relayer')
      it('With relayer address that does not have enough AVT')

      it('With sender that doesnt own this nft')
    })
  })

})
