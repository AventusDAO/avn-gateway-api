const assert = require('chai').assert
const helper = require('./helper.js')
const accounts = helper.ACCOUNTS
const token = helper.TOKEN
const BN = helper.BN
const bnEquals = helper.bnEquals

const waitForTxToBeMined = async () => await helper.sleep(5000)

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
      bnEquals(new BN(await api.query.getAvtBalance(relayer)).gte(relayerAvtBalanceBefore.add(relayerFee)))
    })

    it('can transfer AVT using a recipient public key', async () => {
      const amount = new BN(2)
      await api.send.transferAvt(relayer, sender, recipientPubKey, amount)
      await waitForTxToBeMined()
      bnEquals(recipientAvtBalanceBefore.add(amount), await api.query.getAvtBalance(recipientPubKey))
      bnEquals(senderAvtBalanceBefore.sub(relayerFee).sub(amount), new BN(await api.query.getAvtBalance(sender)))
      bnEquals(new BN(await api.query.getAvtBalance(relayer)).gte(relayerAvtBalanceBefore.add(relayerFee)))
    })
  })
})
