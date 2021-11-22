const assert = require('chai').assert
const helper = require('./helper.js')
const accounts = helper.ACCOUNTS
const token = helper.TOKEN
const BN = helper.BN
const bnEquals = helper.bnEquals
const gatewayFee = new BN(helper.GATEWAY_FEE_IN_AVT)

const waitForTxToBeMined = async () => await helper.sleep(3500)

describe('SendTx api calls:', async () => {
  let api
  let relayer, sender, recipient

  before(async () => {
    api = await helper.avnApi()
    relayer = accounts.relayer.address
    sender = accounts.sender.address
    recipient = accounts.user1.address
    recipientPubKey = accounts.user1.publicKey
  })

  describe('transferAVT', async () => {
    let senderAvtBalanceBefore, recipientAvtBalanceBefore

    beforeEach(async () => {
      senderAvtBalanceBefore = new BN(await api.query.getAvtBalance(sender))
      recipientAvtBalanceBefore = new BN(await api.query.getAvtBalance(recipient))
    })

    it('can transfer AVT using a recipient address', async () => {
      const amount = new BN(1)
      await api.send.transferAvt(relayer, sender, recipient, amount)
      await waitForTxToBeMined()
      bnEquals(recipientAvtBalanceBefore.add(amount), await api.query.getAvtBalance(recipient))
      bnEquals(senderAvtBalanceBefore.sub(gatewayFee).sub(amount), new BN(await api.query.getAvtBalance(sender)))
    })

    it('can transfer AVT using a recipient public key', async () => {
      const amount = new BN(2)
      await api.send.transferAvt(relayer, sender, recipientPubKey, amount)
      await waitForTxToBeMined()
      bnEquals(recipientAvtBalanceBefore.add(amount), await api.query.getAvtBalance(recipientPubKey))
      bnEquals(senderAvtBalanceBefore.sub(gatewayFee).sub(amount), new BN(await api.query.getAvtBalance(sender)))
    })
  })
})
