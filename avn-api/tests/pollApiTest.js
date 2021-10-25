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
      //requestId = await api.send.transferAvt(recipient, 1);
      requestId = '0x4e5f63446ebfc0d80107d4b38f2dafd8052be5f56e98700d91642c72a189660d'
      //console.log(`requestId: ${requestId}`)
    })

    // it('returns a pending state for a valid request ID', async () => {
    //   assert.equal(await api.poll.requestState(requestId), 'Processed');
    // })

    // it('returns a processed state for a valid request ID', async () => {
    //   const maxPoll = 5;
    //   let state;

    //   for (i=0; i< 5; i++) {
    //     await helper.sleep(10000);
    //     state = await api.poll.requestState(requestId);
    //     if (state === 'Processed') break;
    //   }

    //   assert.equal(state, 'Processed');
    // })

    it.skip('returns an error for an invalid request ID', async () => {
      assert.equal(await api.poll.requestState(BAD_REQUEST_ID), "Unable to access request's state");
    })
  })
})