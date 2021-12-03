const assert = require('chai').assert
const helper = require('./helper.js')
const accounts = helper.ACCOUNTS
const token = helper.TOKEN
const BN = helper.BN
const bnEquals = helper.bnEquals

const waitForTxToBeMined = async () => await helper.sleep(5000)

const getConfirmation = async (api, requestId) => {
  if (!requestId) throw new Error(`RequestId cannot be null`)

  let status
  for (i = 0; i < 10; i++) {
    await waitForTxToBeMined()
    status = await api.poll.requestState(requestId)
    if (status === 'Processed') break
  }
  return status
}

describe('SendTx api calls:', async () => {
  let api
  let relayer, sender, recipient
  let relayerFee

  before(async () => {
    api = await helper.avnApi()
    relayer = accounts.relayer.address
    sender = accounts.sender.address
    recipient = accounts.user1.address
    recipientPubKey = accounts.user1.publicKey
    relayerFee = new BN((await api.query.getRelayerFees(relayer, sender)).proxyAvtTransfer)
  })

  describe('transferAVT', async () => {
    let senderAvtBalanceBefore, recipientAvtBalanceBefore, relayerAvtBalanceBefore

    beforeEach(async () => {
      senderAvtBalanceBefore = new BN(await api.query.getAvtBalance(sender))
      recipientAvtBalanceBefore = new BN(await api.query.getAvtBalance(recipient))
      relayerAvtBalanceBefore = new BN(await api.query.getAvtBalance(relayer))
    })

    it('can transfer AVT using a recipient address', async () => {
      const amount = new BN(1)
      await api.send.transferAvt(relayer, sender, recipient, amount)
      await waitForTxToBeMined()
      bnEquals(recipientAvtBalanceBefore.add(amount), await api.query.getAvtBalance(recipient))
      bnEquals(senderAvtBalanceBefore.sub(relayerFee).sub(amount), new BN(await api.query.getAvtBalance(sender)))
      // TODO: include network fees when we've sorted the accounts out
      bnEquals(new BN(await api.query.getAvtBalance(relayer)).gte(relayerAvtBalanceBefore.add(relayerFee)))
    })

    it('can transfer AVT using a recipient public key', async () => {
      const amount = new BN(2)
      await api.send.transferAvt(relayer, sender, recipientPubKey, amount)
      await waitForTxToBeMined()
      bnEquals(recipientAvtBalanceBefore.add(amount), await api.query.getAvtBalance(recipientPubKey))
      bnEquals(senderAvtBalanceBefore.sub(relayerFee).sub(amount), new BN(await api.query.getAvtBalance(sender)))
      // TODO: include network fees when we've sorted the accounts out
      bnEquals(new BN(await api.query.getAvtBalance(relayer)).gte(relayerAvtBalanceBefore.add(relayerFee)))
    })
  })

  describe('mintSingleNft', async () => {
    let externalRef, royalties, t1Authority, royaltyRecipient1, royaltyRecipient2, royaltyRate1, royaltyRate2

    before(async () => {
      royalties = []
      t1Authority = '0xd6ae8250b8348c94847280928c79fb3b63ca453e'
      royaltyRecipient1 = '0xf8f77379A1C6b5CA66702b5943c5b229E310Ec03'
      royaltyRecipient2 = '0xE566A65705F2d8D6C1Da9063A29b6F0f1Ac1e6Da'
      royaltyRate1 = 10000
      royaltyRate2 = 20000
    })

    beforeEach(async () => {
      externalRef = 'avn-gateway-test-' + new Date().toISOString() // This must be unique across all mints
    })

    it('can mint single nft', async () => {
      const requestId = await api.send.mintSingleNft(relayer, sender, externalRef, royalties, t1Authority)
      const mintOutcome = await getConfirmation(api, requestId)
      assert.equal(mintOutcome, 'Processed')
    })

    it('can mint single nft with a single royalty', async () => {
      royalties = [
        {
          recipient_t1_address: royaltyRecipient1,
          rate: {
            parts_per_million: royaltyRate1
          }
        }
      ]
      const requestId = await api.send.mintSingleNft(relayer, sender, externalRef, royalties, t1Authority)
      const mintOutcome = await getConfirmation(api, requestId)
      assert.equal(mintOutcome, 'Processed')
    })

    it('can mint single nft with multiple royalties', async () => {
      royalties = [
        {
          recipient_t1_address: royaltyRecipient1,
          rate: {
            parts_per_million: royaltyRate1
          }
        },
        {
          recipient_t1_address: royaltyRecipient2,
          rate: {
            parts_per_million: royaltyRate2
          }
        }
      ]

      const requestId = await api.send.mintSingleNft(relayer, sender, externalRef, royalties, t1Authority)
      const mintOutcome = await getConfirmation(api, requestId)
      assert.equal(mintOutcome, 'Processed')
    })
  })

  describe('listNftOpenForSale', async () => {
    let externalRef, nftId
    const royalties = []
    const t1Authority = '0xd6ae8250b8348c94847280928c79fb3b63ca453e'

    beforeEach(async () => {
      externalRef = 'avn-gateway-test-' + new Date().toISOString()
      console.log(externalRef)
      const requestId = await api.send.mintSingleNft(relayer, sender, externalRef, royalties, t1Authority)
      const mintOutcome = await getConfirmation(api, requestId)
      nftId = api.query.getNftId(externalRef)
    })

    it('can list an NFT as open for sale', async () => {
      const requestId = await api.send.listNftOpenForSale(relayer, sender, nftId, 'Fiat')
      const listOutcome = await getConfirmation(api, requestId)
      assert.equal(listOutcome, 'Processed')
    })
  })
})
