const assert = require('chai').assert
const helper = require('./helper.js')
const accounts = helper.ACCOUNTS
const token = helper.TOKEN
const gatewayFee = helper.GATEWAY_FEE_IN_AVT
const BN = helper.BN
const bnEquals = helper.bnEquals
const BAD_TOKEN = '0x0000000000000000000000000000000000000000'

const waitForTxToBeMined = async () => await helper.sleep(3500)

describe('Proxy api calls:', async () => {
  let api
  let relayer, sender, recipient

  before(async () => {
    api = await helper.avnApi()
    relayer = accounts.relayer.address
    sender = accounts.sender.address
    recipient = accounts.user1.address
    recipientPubKey = accounts.user1.publicKey
  })

  describe('transferToken', async () => {
    let senderTokenBalanceBefore, recipientBalanceBefore
    let senderNonceBefore

    beforeEach(async () => {
      senderAvtBalanceBefore = new BN(await api.query.getAvtBalance(sender))
      senderTokenBalanceBefore = new BN(await api.query.getTokenBalance(sender, token))
      recipientBalanceBefore = new BN(await api.query.getTokenBalance(recipient, token))
      senderNonceBefore = new BN(await api.query.getAccountNonce(sender))
    })

    it('can transfer tokens using a recipient public key', async () => {
      const amount = new BN(2)
      await api.send.transferToken(relayer, sender, recipientPubKey, token, amount)
      await waitForTxToBeMined()
      bnEquals(senderAvtBalanceBefore.sub(gatewayFee), await api.query.getAvtBalance(sender))
      bnEquals(senderTokenBalanceBefore.sub(amount), await api.query.getTokenBalance(sender, token))
      bnEquals(recipientBalanceBefore.add(amount), await api.query.getTokenBalance(recipient, token))
      bnEquals(senderNonceBefore.add(new BN(1)), await api.query.getAccountNonce(sender))
    })

    it('can make multiple token transfers using a recipient address', async function() {
      this.timeout(400000) //increase the timeout of this test (https://mochajs.org/#test-level)

      const amount = new BN(1)
      const numTx = new BN(10)

      for (i = 0; i < numTx; i++) {
        await api.send.transferToken(relayer, sender, recipient, token, amount)
      }

      await waitForTxToBeMined()
      bnEquals(senderAvtBalanceBefore.sub(gatewayFee.mul(numTx)), await api.query.getAvtBalance(sender))
      bnEquals(senderTokenBalanceBefore.sub(amount.mul(numTx)), await api.query.getTokenBalance(sender, token))
      bnEquals(recipientBalanceBefore.add(amount.mul(numTx)), await api.query.getTokenBalance(recipient, token))
      bnEquals(senderNonceBefore.add(numTx), await api.query.getAccountNonce(sender))
    })
  })
})
