const assert = require('chai').assert;
const helper = require('./helper.js');
const accounts = helper.ACCOUNTS;

const BAD_REQUEST_ID = '0x0000000000000000000000000000000000000000000000000000000000000000'

describe('Polling api calls:', async() => {
  let api;
  let user;

  before(async () => {
    api = await helper.avnApi();
    user = accounts.user2.address;
  })

  describe('requestState', async () => {
    let requestId;

    before(async () => {
      requestId = await api.send.transferAvt(user, 1);
    })

    it('returns a pending state for a valid request ID', async () => {
      assert.equal(await api.poll.requestState(requestId), 'Pending');
    })

    it('returns an error for an invalid request ID', async () => {
      assert.equal(await api.poll.requestState(BAD_REQUEST_ID), "Unable to access request's state");
    })
  })
})