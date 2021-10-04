var assert = require('chai').assert;

describe('Query api calls:', function() {

  before(async () => {
    // Implement me if required
  })

  after(async() => {
    // Implement me if required
  })

  // One high level describe per end point
  describe('getTotalAvt', function() {

    // One happy path
    it.skip('succeeds', async () => {
      assert(false, 'getTotalAvt should succeed');
    })

    // A describe block for failing tests, each testing one bad condition
    describe('fails when', function() {
      it.skip('the awt token is invalid', async () => {
        assert(false, 'getTotalAvt should not succeed with an invalid token');
      })

      it.skip('the request is not a valid JSON-RPC call', async () => {
        assert(false, 'Only valid JSON-RPC is allowed');
      })

      // If the query takes parameters, we should also test them
    })
  })
})