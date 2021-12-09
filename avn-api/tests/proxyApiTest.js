const assert = require('chai').assert
const helper = require('./helper.js')
const accounts = helper.ACCOUNTS
const BN = helper.BN
const bnEquals = helper.bnEquals
const BAD_TOKEN = '0x0000000000000000000000000000000000000000'

const waitForTxToBeMined = async () => await helper.sleep(5000)

describe('Proxy api calls:', async () => {
  let api, token
  let relayer, sender, recipient
  let relayerFee

  before(async () => {
    token = helper.token
    api = await helper.avnApi()
    relayer = accounts.relayer.address
    sender = accounts.sender.address
    recipient = accounts.user1.address
    recipientPubKey = accounts.user1.publicKey
    relayerFee = new BN((await api.query.getRelayerFees(relayer, sender)).proxyTokenTransfer)
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
      bnEquals(senderAvtBalanceBefore.sub(relayerFee), new BN(await api.query.getAvtBalance(sender)))
      // TODO: include network fees when we've sorted the accounts out
      bnEquals(new BN(await api.query.getAvtBalance(relayer)).gte(relayerAvtBalanceBefore.add(relayerFee)))
    })

    it('can make multiple token transfers using a recipient address', async function() {
      this.timeout(400000) //increase the timeout of this test (https://mochajs.org/#test-level)

      const amount = new BN(1)
      const numTx = new BN(10)

      for (i = 0; i < numTx; i++) {
        await api.send.transferToken(relayer, sender, recipient, token, amount)
      }

      await waitForTxToBeMined()
      bnEquals(senderTokenBalanceBefore.sub(amount.mul(numTx)), new BN(await api.query.getTokenBalance(sender, token)))
      bnEquals(
        recipientTokenBalanceBefore.add(amount.mul(numTx)),
        new BN(await api.query.getTokenBalance(recipient, token))
      )
      bnEquals(senderNonceBefore.add(numTx), new BN(await api.query.getAccountNonce(sender)))
      bnEquals(senderAvtBalanceBefore.sub(relayerFee.mul(numTx)), new BN(await api.query.getAvtBalance(sender)))
      // TODO: include network fees when we've sorted the accounts out
      bnEquals(new BN(await api.query.getAvtBalance(relayer)).gte(relayerAvtBalanceBefore.add(relayerFee.mul(numTx))))
    })
  })
})
