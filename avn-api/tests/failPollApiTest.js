const chai = require('chai');
const expect = chai.expect;
const testPatterns = require('./testPatterns.js');
const helper = require('./helper.js');

// Immediately Invoked Function Expression to make async calls available before the test suite
// This makes run() method available to be called with --delay flag
(async function () {
  // const api = await helper.avnApi();
  const avnApi = await helper.avnApi({
    suri: accounts.user.seed
  });
  const api = await avnApi.apis();
  describe('Fail Poll api calls:', async () => {
    describe('requestState', async () => {
      describe('fails when called', async () => {
        let testConfig = {
          validCallData: {
            requestId: 'Processed'
          },
          selectionField: 'requestId',
          testFunction: api.poll.requestState
        };
        describe('With invalid request', async () => {
          await testPatterns.invalidRequestState(testConfig);
        });
      });
    });
  });
  run();
})();
