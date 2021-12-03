const assert = require('chai').assert
const AvnApi = require('../avn-api/index.js')
const { gateway, accounts } = require('../avn-api/config/avn.json')
const BN = require('bn.js')

describe('AVN Gateway Smoke Tests', function() {
  let api, relayer, sender, recipient

  before(async () => {
    api = new AvnApi(gateway)
    await api.init()

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
    assert(requestId !== undefined, 'requestId is undefined')
    assert(requestId !== 'Invalid params', 'request contains invalid params')
    assert(['Pending', 'Processed'].includes(await api.poll.requestState(requestId)), 'transaction state is neither Pending nor Processed')
  })
})