var assert = require('chai').assert;

describe('Polling api calls', function() {

  before(async () => {
    // Implement me if required
  })

  after(async() => {
    // Implement me if required
  })

  // One happy path for standard transactions
  it.skip('<happy path (regular transactions) wording>', async () => {
    assert(false, '<failure reason>');
  })

  // TODO: Discuss how we want to deal with these first before writting tests
  // One happy path for Ethereum events transactions, such as Lift, that require waiting for challenge periods
  it.skip('<happy path (Ethereum Events transactions) wording>', async () => {
    assert(false, '<failure reason>');
  })

  // A describe block for failing tests, each testing one bad condition
  describe('<failure wording>', function() {
    it.skip('<bad case test 1>', async () => {
      assert(false, '<failure reason>');
    })

    it.skip('<bad case test 2>', async () => {
      assert(false, '<failure reason>');
    })

    // ...
  })
})