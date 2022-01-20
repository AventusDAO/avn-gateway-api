const chai = require('chai')
const expect = chai.expect
const assert = chai.assert
const testPatterns = require('./testPatterns.js')

describe('Fail Poll api calls:', async () => {

  before(async () => {
    //set up params
  })

  beforeEach(async () => {
    //reset state for isolation of tests
  })

  describe('requestState', async () => {
    //requestState(requestId)
    describe('fails when called', async () => {
      describe('With invalid request', async () => {
        await testPatterns.validRequestState('Request', 'requestId', 'validCallData');
      })
    })
  })
})
