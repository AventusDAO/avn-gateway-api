var assert = require('chai').assert;

describe('Query EC2 calls:', function() {

  before(async () => {
    // Implement me if required
  })

  after(async() => {
    // Implement me if required
  })

  // One happy path
  it.skip('succeeds', async () => {
    assert(false, 'Well formed query should work');
  })

  // A describe block for failing tests, each testing one bad condition
  describe('fails when', function() {
    it.skip('Pallet name is wrong', async () => {
      assert(false, 'Invalid pallet name should cause an error');
    })

    it.skip('Storage name is wrong', async () => {
      assert(false, 'Invalid storage name should cause an error');
    })

    it.skip('All parameters are missing', async () => {
      assert(false, 'Missing parameters should cause an error');
    })

    it.skip('Some parameters are missing', async () => {
      assert(false, 'Some missing parameters should cause an error');
    })

    it.skip('Parameters have the wrong order', async () => {
      assert(false, 'Incorrectly ordered parameters should cause an error');
    })

    it.skip('Parameters have the wrong format', async () => {
      assert(false, 'Incorrectly formatted parameters should cause an error');
    })

  })

})