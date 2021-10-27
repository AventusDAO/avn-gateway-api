const assert = require('chai').assert;
const helper = require('./helper.js');
const accounts = helper.ACCOUNTS;

const BAD_REQUEST_ID = '0x0000000000000000000000000000000000000000000000000000000000000000'

describe('Polling api calls:', async() => {
  let api;
  let recipient;

  before(async () => {
    api = await helper.avnApi();
    recipient = accounts.user1.address;
  })

  describe('requestState', async () => {
    let requestId;

    before(async () => {
      requestId = await api.send.transferAvt(recipient, 1);
      console.log(`polling requestId: ${requestId}`)
    })

    it('returns a pending status for a valid request ID', async () => {
      assert.equal(await api.poll.requestState(requestId), 'Pending');
    })

    it('returns a processed status for a valid request ID', async () => {
      const maxPoll = 5;
      let status;

      for (i = 0; i < 10; i ++) {
        await helper.sleep(3000);
        status = await api.poll.requestState(requestId);
        if (status === 'Processed') break;
        console.log(`   Current status: ${status}`)
      }

      assert.equal(status, 'Processed');
    })

    it.skip('returns an error for an invalid request ID', async () => {
      assert.equal(await api.poll.requestState(BAD_REQUEST_ID), "Unable to access request's status");
    })
  })
})