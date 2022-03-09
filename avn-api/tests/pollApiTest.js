const assert = require('chai').assert;
const { v4: uuidv4 } = require('uuid');
const helper = require('./helper.js');
const accounts = helper.ACCOUNTS;
const BN = helper.BN;

describe('Polling api calls:', async () => {
  let api;
  let recipient;

  before(async () => {
    api = await helper.avnApi();
    relayer = accounts.relayer.address;
    sender = accounts.sender.address;
    recipient = accounts.user1.address;
  });

  describe('requestState', async () => {
    let requestId, invalidRequestId;

    before(async () => {
      const senderAvtBalance = await api.query.getAvtBalance(sender);
      const validAmount = new BN('1');
      const invalidAmount = new BN(senderAvtBalance).add(new BN('1')).toString();

      requestId = await api.send.transferAvt(relayer, recipient, validAmount);
      invalidRequestId = await api.send.transferAvt(relayer, recipient, invalidAmount);
    });

    it('returns a pending status and transaction hash for a valid request ID', async () => {
      let result = await api.poll.requestState(requestId);
      assert.equal(result.txHash.length, 66);
      assert.equal(result.status, 'Pending');
    });

    it('returns a rejected status when a transaction fails to be executed', async () => {
      await helper.confirmStatus(api, invalidRequestId, 'Rejected');
    });

    it('returns a processed status for a valid request ID', async () => {
      await helper.confirmStatus(api, requestId, 'Processed');
    });

    it('returns an error for an unknown request ID', async () => {
      const badRequestId = uuidv4();
      assert.equal(await api.poll.requestState(badRequestId), 'Transaction not found');
    });
  });
});
