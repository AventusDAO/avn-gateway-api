const chai = require('chai')
const expect = chai.expect
const assert = chai.assert
chai.use(require('chai-as-promised'))
const helper = require('./helper.js')
const accounts = helper.ACCOUNTS

describe('Fail Query api calls:', async () => {
  let api
  let validSender
  let validToken
  let validRelayer
  let emptyStringValue, undefinedValue
  let shortAccountAddress, longAccountAddress
  let wrong_type

  before(async () => {
    api = await helper.avnApi()
    validRelayer = accounts.relayer
    validSender = accounts.sender
    validToken = helper.token

    emptyStringValue = ""
    undefinedValue = undefined
    wrong_type = "wrong_type"

    notExistentAccount = "0xEA674fdDe714fd979de3EdF0F56AA9716B898ec8"
    notExistentTokenId = "fake_token_id"

    invalidAddressFormat = "invalid_address"
    invalidTokenFormat = "invalid_token"
    invalidExternalReference = "invalid_reference"

    shortTokenAddress = "0xb130395ae89acbe3299"
    longTokenAddress = "0xb130395ae89acbe32999f8eb6e6114a56d676199918d9a8sDa7s6Bdg"

    shortAccountAddress = "5DAgxVxKmnJ7hfhDEB9UetZm4jR2MPjGZGrmJZj"
    longAccountAddress = "5DAgxVxKmnJ7hfhDEB9UetZm4jR2MPjGZGrmJZjirSVJDdMrfsdfdsfs"

  })

  describe('getAvtBalance', async () => {
    describe('fails when called', async () => {
      it('With account as empty string', async () => {
        await expect(api.query.getAvtBalance(emptyStringValue)).to.be.rejectedWith(Error)
      })
      it('With account as undefined', async () => {
        await expect(api.query.getAvtBalance(undefinedValue)).to.be.rejectedWith(Error)
      })
      it('With account in invalid format', async () => {
        await expect(api.query.getAvtBalance(invalidAddressFormat)).to.be.rejectedWith(Error)
      })
      it('With account address short', async () => {
        await expect(api.query.getAvtBalance(shortAccountAddress)).to.be.rejectedWith(Error)
      })
      it('With account address long', async () => {
        await expect(api.query.getAvtBalance(longAccountAddress)).to.be.rejectedWith(Error)
      })
    })
  })


  describe('getTokenBalance', async () => {
    describe('fails when called', async () => {
      it('With account as empty string', async () => {
        await expect(api.query.getTokenBalance(emptyStringValue, validToken)).to.be.rejectedWith(Error)
      })
      it('With account as undefined', async () => {
        await expect(api.query.getTokenBalance(undefinedValue, validToken)).to.be.rejectedWith(Error)
      })
      it('With account in invalid format', async () => {
        await expect(api.query.getTokenBalance(invalidAddressFormat, validToken)).to.be.rejectedWith(Error)
      })
      it('With account address short', async () => {
        await expect(api.query.getTokenBalance(shortAccountAddress, validToken)).to.be.rejectedWith(Error)
      })
      it('With account address long', async () => {
        await expect(api.query.getTokenBalance(longAccountAddress, validToken)).to.be.rejectedWith(Error)
      })
      it('With token as empty string', async () => {
        await expect(api.query.getTokenBalance(validSender.address, emptyStringValue)).to.be.rejectedWith(Error)
      })
      it('With token as undefined', async () => {
        await expect(api.query.getTokenBalance(validSender.address, undefinedValue)).to.be.rejectedWith(Error)
      })
      it('With token in invalid format', async () => {
        await expect(api.query.getTokenBalance(validSender.address, invalidTokenFormat)).to.be.rejectedWith(Error)
      })
      it('With token address short', async () => {
        await expect(api.query.getTokenBalance(validSender.address, shortTokenAddress)).to.be.rejectedWith(Error)
      })
      it('With token address long', async () => {
        await expect(api.query.getTokenBalance(validSender.address, longTokenAddress)).to.be.rejectedWith(Error)
      })
    })
  })

  describe('getAccountNonce', async () => {
    describe('fails when called', async () => {
      it('With account as empty string', async () => {
        await expect(api.query.getAccountNonce(emptyStringValue)).to.be.rejectedWith(Error)
      })
      it('With account as undefined', async () => {
        await expect(api.query.getAccountNonce(undefinedValue)).to.be.rejectedWith(Error)
      })
      it('With account in invalid format', async () => {
        await expect(api.query.getAccountNonce(invalidAddressFormat)).to.be.rejectedWith(Error)
      })
      it('With account address short', async () => {
        await expect(api.query.getAccountNonce(shortAccountAddress)).to.be.rejectedWith(Error)
      })
      it('With account address long', async () => {
        await expect(api.query.getAccountNonce(longAccountAddress)).to.be.rejectedWith(Error)
      })
      it('With account in valid format but not existent', async () => {
        await expect(api.query.getAccountNonce(notExistentAccount)).to.be.rejectedWith(Error)
      })
    })
  })

  describe('getAccountPaymentNonce', async () => {
    describe('fails when called', async () => {
      it('With account as empty string', async () => {
        await expect(api.query.getAccountPaymentNonce(emptyStringValue)).to.be.rejectedWith(Error)
      })
      it('With account as undefined', async () => {
        await expect(api.query.getAccountPaymentNonce(undefinedValue)).to.be.rejectedWith(Error)
      })
      it('With account in invalid format', async () => {
        await expect(api.query.getAccountPaymentNonce(invalidAddressFormat)).to.be.rejectedWith(Error)
      })
      it('With account address short', async () => {
        await expect(api.query.getAccountPaymentNonce(shortAccountAddress)).to.be.rejectedWith(Error)
      })
      it('With account address long', async () => {
        await expect(api.query.getAccountPaymentNonce(longAccountAddress)).to.be.rejectedWith(Error)
      })
      it('With account in valid format but not existent', async () => {
        await expect(api.query.getAccountPaymentNonce(notExistentAccount)).to.be.rejectedWith(Error)
      })
    })
  })

  describe('getRelayerFees', async () => {
    describe('fails when called', async () => {
      it('With relayer as empty string', async () => {
        await expect(api.query.getRelayerFees(emptyStringValue)).to.be.rejectedWith(Error)
      })
      it('With relayer as undefined', async () => {
        await expect(api.query.getRelayerFees(undefinedValue)).to.be.rejectedWith(Error)
      })
      it('With relayer address in invalid format', async () => {
        await expect(api.query.getRelayerFees(invalidAddressFormat)).to.be.rejectedWith(Error)
      })
      it('With relayer address short', async () => {
        await expect(api.query.getRelayerFees(shortAccountAddress)).to.be.rejectedWith(Error)
      })
      it('With relayer address long', async () => {
        await expect(api.query.getRelayerFees(longAccountAddress)).to.be.rejectedWith(Error)
      })
      it('With relayer address that is not a relayer', async () => {
        await expect(api.query.getRelayerFees(validSender.address)).to.be.rejectedWith(Error)
      })
      it('With user in invalid format', async () => {
        await expect(api.query.getRelayerFees(validRelayer.address, invalidAddressFormat)).to.be.rejectedWith(Error)
      })
      it('With user address short', async () => {
        await expect(api.query.getRelayerFees(validRelayer.address, shortAccountAddress)).to.be.rejectedWith(Error)
      })
      it('With user address long', async () => {
        await expect(api.query.getRelayerFees(validRelayer.address, longAccountAddress)).to.be.rejectedWith(Error)
      })
      it('With transaction type wrong', async () => {
        await expect(api.query.getRelayerFees(validRelayer.address, validSender.address, wrong_type)).to.be.rejectedWith(Error)
      })
    })
  })

  describe('getNftNonce', async () => {
    describe('fails when called', async () => {
      it('With nft id as empty string', async () => {
        await expect(api.query.getNftNonce(emptyStringValue)).to.be.rejectedWith(Error)
      })
      it('With nft id as undefined', async () => {
        await expect(api.query.getNftNonce(undefinedValue)).to.be.rejectedWith(Error)
      })
      it('With nft id that doesnt exist', async () => {
        await expect(api.query.getNftNonce(notExistentTokenId)).to.be.rejectedWith(Error)
      })
    })
  })

  describe('getNftId', async () => {
    describe('fails when called', async () => {
      it('With external reference as empty string', async () => {
        await expect(api.query.getNftId(emptyStringValue)).to.be.rejectedWith(Error)
      })
      it('With external reference as undefined', async () => {
        await expect(api.query.getNftId(undefinedValue)).to.be.rejectedWith(Error)
      })
      it('With external reference in invalid format', async () => {
        await expect(api.query.getNftId(invalidExternalReference)).to.be.rejectedWith(Error)
      })
      it('With external reference in valid format but not existent', async () => {
        await expect(api.query.getNftId(notExistentTokenId)).to.be.rejectedWith(Error)
      })
    })
  })

  describe('getNftOwner', async () => {
    describe('fails when called', async () => {
      it('With nft id as empty string', async () => {
        await expect(api.query.getNftId(emptyStringValue)).to.be.rejectedWith(Error)
      })
      it('With nft id as undefined', async () => {
        await expect(api.query.getNftId(undefinedValue)).to.be.rejectedWith(Error)
      })
      it('With nft id that doesnt exist', async () => {
        await expect(api.query.getNftId(notExistentTokenId)).to.be.rejectedWith(Error)
      })
    })
  })
})
