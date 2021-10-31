const assert = require('chai').assert;
const helper = require('./helper.js');
const accounts = helper.ACCOUNTS;

const BAD_REQUEST_ID = '0x0000000000000000000000000000000000000000000000000000000000000000'

describe('Polling api calls:', async() => {
  let api;
  let recipient;

  before(async () => {
    api = await helper.avnApi();
    relayer = accounts.relayer.address;
    sender = accounts.sender.address;
    recipient = accounts.user1.address;
  })

  describe('requestState', async () => {
    let requestId, invalidRequestId;

    before(async () => {
      requestId = await api.send.transferAvt(relayer, sender, recipient, 1);
      invalidRequestId = await api.send.transferAvt(relayer, sender, recipient, "9000000000000000000000000");
      console.log(`Valid requestId: ${requestId}, Invalid requestId: ${invalidRequestId}`)
    })

    it('returns a pending status for a valid request ID', async () => {
      assert.equal(await api.poll.requestState(requestId), 'Pending');
    })

    it('returns a rejected status when a transaction fails to be executed', async () => {
      const maxPoll = 5;
      let status;

      for (i = 0; i < 10; i ++) {
        await helper.sleep(3000);
        status = await api.poll.requestState(invalidRequestId);
        if (status === 'Rejected') break;
        console.log(`   Current status (invalid request): ${status}`)
      }

      assert.equal(status, 'Rejected');
    })

    it('returns a processed status for a valid request ID', async () => {
      const maxPoll = 5;
      let status;

      for (i = 0; i < 10; i ++) {
        await helper.sleep(3000);
        status = await api.poll.requestState(requestId);
        if (status === 'Processed') break;
        console.log(`   Current status (valid request): ${status}`)
      }

      assert.equal(status, 'Processed');
    })

    it.skip('returns an error for an invalid request ID', async () => {
      assert.equal(await api.poll.requestState(BAD_REQUEST_ID), "Unable to access request's status");
    })
  })
})