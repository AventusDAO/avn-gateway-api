const chai = require('chai');
const expect = chai.expect;
const testPatterns = require('./testPatterns.js');
const helper = require('./helper.js');

// Immediately Invoked Function Expression function to make async calls available before the test suite
// Must call run() method with --delay flag

(async function () {
  const api = await helper.avnApi();
  describe('Fail Poll api calls:', async () => {
    describe('requestState', async () => {
      describe('fails when called', async () => {
        let validCallData = {
          requestId: 'Processed'
        };
        describe('With invalid request', async () => {
          await testPatterns.invalidRequestState('Request', validCallData, api.poll.requestState);
        });
      });
    });
  });
  run();
})();
