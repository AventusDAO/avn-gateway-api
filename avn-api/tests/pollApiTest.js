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
    user = accounts.user.address;
    recipient = accounts.otherUser.address;
  });

  describe('requestState', async () => {
    let requestId, invalidRequestId;

    before(async () => {
      const userAvtBalance = await api.query.getAvtBalance(user);
      const validAmount = new BN('1');
      const invalidAmount = new BN(userAvtBalance).add(new BN('1')).toString();

      requestId = await api.send.transferAvt(relayer, recipient, validAmount);
      invalidRequestId = await api.send.transferAvt(relayer, recipient, invalidAmount);
    });

    it('returns a pending status and transaction hash for a valid request ID', async () => {
      let index = 0;
      let result = await api.poll.requestState(requestId);

      //If there is a delay in sending the tx,
      while (result === 'Transaction not found' && index < 50) {
        result = await api.poll.requestState(requestId);
        index++;
      }

      assert(result !== 'Transaction not found' && index < 50, 'Error getting transaction status');

      assert.equal(result.txHash.length, 66);
      assert.equal(result.status, 'Pending');
    });

    it('returns a rejected status when a transaction fails to be executed', async () => {
      await helper.confirmStatus(api, invalidRequestId, 'Rejected');
      let result = await api.poll.requestState(invalidRequestId);
      assert(result.blockNumber != '0');
      assert(result.transactionIndex != '0');
    });

    it('returns a processed status for a valid request ID', async () => {
      await helper.confirmStatus(api, requestId, 'Processed');
      let result = await api.poll.requestState(requestId);
      assert(result.blockNumber != '0');
      assert(result.transactionIndex != '0');
    });

    it('returns an error for an unknown request ID', async () => {
      const badRequestId = uuidv4();
      assert.equal(await api.poll.requestState(badRequestId), 'Transaction not found');
    });
  });
});
