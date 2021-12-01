const assert = require('chai').assert
const helper = require('../avn-api/tests/helper')
const accounts = helper.ACCOUNTS
const BN = helper.BN

const waitForTxToBeMined = async () => await helper.sleep(5000)

describe('AVN Gateway Smoke Tests', function() {
  let api, relayer, sender, recipient

  before(async () => {
    api = await helper.avnApi()
    relayer = accounts.relayer.address
    sender = accounts.sender.address
    recipient = accounts.user1.address
  })

  it('query account balance', async () => {
    const senderBalance = await api.query.getAvtBalance(sender)
    assert(senderBalance)
  })

  it('proxy AVT transfer and poll transaction state', async () => {
    const amount = new BN('1')
    const requestId = await api.send.transferAvt(relayer, sender, recipient, amount)
    assert(requestId, 'requestId is undefined')
    assert(['Pending', 'Processed'].includes(await api.poll.requestState(requestId)), 'transaction state is neither Pending nor Processed')
  })
})