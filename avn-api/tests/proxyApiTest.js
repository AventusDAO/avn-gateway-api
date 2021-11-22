const assert = require('chai').assert
const helper = require('./helper.js')
const accounts = helper.ACCOUNTS
const token = helper.TOKEN
const BN = helper.BN
const bnEquals = helper.bnEquals
const gatewayFee = new BN(helper.GATEWAY_FEE_IN_AVT)
const BAD_TOKEN = '0x0000000000000000000000000000000000000000'

const waitForTxToBeMined = async () => await helper.sleep(5000)

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
    let senderAvtBalanceBefore, relayerAvtBalanceBefore, senderTokenBalanceBefore, recipientTokenBalanceBefore
    let senderNonceBefore

    beforeEach(async () => {
      senderAvtBalanceBefore = new BN(await api.query.getAvtBalance(sender))
      senderTokenBalanceBefore = new BN(await api.query.getTokenBalance(sender, token))
      recipientTokenBalanceBefore = new BN(await api.query.getTokenBalance(recipient, token))
      relayerAvtBalanceBefore = new BN(await api.query.getAvtBalance(relayer))
      senderNonceBefore = new BN(await api.query.getAccountNonce(sender))
    })

    it('can transfer tokens using a recipient public key', async () => {
      const amount = new BN(2)
      await api.send.transferToken(relayer, sender, recipientPubKey, token, amount)
      await waitForTxToBeMined()
      bnEquals(senderTokenBalanceBefore.sub(amount), new BN(await api.query.getTokenBalance(sender, token)))
      bnEquals(recipientTokenBalanceBefore.add(amount), new BN(await api.query.getTokenBalance(recipient, token)))
      bnEquals(senderNonceBefore.add(new BN(1)), new BN(await api.query.getAccountNonce(sender)))
      bnEquals(senderAvtBalanceBefore.sub(gatewayFee), new BN(await api.query.getAvtBalance(sender)))
      bnEquals(new BN(await api.query.getAvtBalance(relayer)).gte(relayerAvtBalanceBefore.add(gatewayFee)))
    })

    it('can make multiple token transfers using a recipient address', async function() {
      this.timeout(400000) //increase the timeout of this test (https://mochajs.org/#test-level)

      const amount = new BN(1)
      const numTx = new BN(23)

      for (i = 0; i < numTx; i++) {
        await api.send.transferToken(relayer, sender, recipient, token, amount)
      }

      await waitForTxToBeMined()
      bnEquals(senderTokenBalanceBefore.sub(amount.mul(numTx)), new BN(await api.query.getTokenBalance(sender, token)))
      bnEquals(recipientTokenBalanceBefore.add(amount.mul(numTx)), new BN(await api.query.getTokenBalance(recipient, token)))
      bnEquals(senderNonceBefore.add(numTx), new BN(await api.query.getAccountNonce(sender)))
      bnEquals(senderAvtBalanceBefore.sub(gatewayFee.mul(numTx)), new BN(await api.query.getAvtBalance(sender)))
      bnEquals(new BN(await api.query.getAvtBalance(relayer)).gte(relayerAvtBalanceBefore.add(gatewayFee.mul(numTx))))
    })
  })
})
