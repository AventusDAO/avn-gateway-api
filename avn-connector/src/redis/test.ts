// import redisClient from './index'
// import logger from '../logger'

// async function runTests() {
//   try {
//     // Connect to Redis
//     await redisClient.connect()
//     logger.info('Connected to Redis')

//     // Basic key-value operations
//     await testKeyValueOperations()

//     // Hash operations
//     await testHashOperations()

//     // Set operations
//     await testSetOperations()

//     // Multi-exec operations
//     await testMultiExecOperations()

//     // Custom Redis commands
//     await testCustomRedisCommands()

//     // Transaction operations
//     await testTransactionOperations()

//     // More specific RedisClient methods
//     await testRedisClientMethods()

//     // Clean up
//     await cleanUp()
//     logger.info('All tests completed successfully')
//   } catch (error: any) {
//     logger.error(`An error occurred during testing: ${error.message}`)
//   }
// }

// async function testKeyValueOperations() {
//   logger.info('Testing key-value operations...')
//   await redisClient.setKey('testKey', 'testValue', 60)
//   let value = await redisClient.getKey('testKey')
//   logger.info(`Value of testKey: ${value}`)

//   await redisClient.setKey('testKey', 'newValue')
//   value = await redisClient.getKey('testKey')
//   logger.info(`Updated value of testKey: ${value}`)

//   await redisClient.delKey('testKey')
//   value = await redisClient.getKey('testKey')
//   logger.info(`Value of testKey after deletion: ${value}`)
// }

// async function testHashOperations() {
//   logger.info('Testing hash operations...')
//   const hashData = { field1: 'value1', field2: 'value2' }
//   await redisClient.hsetKey('testHashKey', hashData)
//   let hashValue = await redisClient.hgetKey('testHashKey')
//   logger.info(`Value of testHashKey: ${JSON.stringify(hashValue)}`)

//   const updateData = { field2: 'newValue2', field3: 'value3' }
//   await redisClient.hsetKey('testHashKey', updateData)
//   hashValue = await redisClient.hgetKey('testHashKey')
//   logger.info(`Updated value of testHashKey: ${JSON.stringify(hashValue)}`)

//   await redisClient.delKey('testHashKey')
//   hashValue = await redisClient.hgetKey('testHashKey')
//   logger.info(
//     `Value of testHashKey after deletion: ${JSON.stringify(hashValue)}`
//   )
// }

// async function testSetOperations() {
//   logger.info('Testing set operations...')
//   await redisClient.saddKey('testSet', 'member1')
//   await redisClient.saddKey('testSet', 'member2')
//   let setMembers = await redisClient.smembersKey('testSet')
//   logger.info(`Members of testSet: ${setMembers.join(', ')}`)

//   await redisClient.sremKey('testSet', 'member1')
//   setMembers = await redisClient.smembersKey('testSet')
//   logger.info(`Updated members of testSet: ${setMembers.join(', ')}`)

//   await redisClient.delKey('testSet')
//   setMembers = await redisClient.smembersKey('testSet')
//   logger.info(`Members of testSet after deletion: ${setMembers.join(', ')}`)
// }

// async function testMultiExecOperations() {
//   logger.info('Testing multi-exec operations...')
//   await redisClient.multiExec([
//     ['set', ['multiTestKey1', 'value1']],
//     ['set', ['multiTestKey2', 'value2']]
//   ])
//   const multiValue1 = await redisClient.getKey('multiTestKey1')
//   const multiValue2 = await redisClient.getKey('multiTestKey2')
//   logger.info(`Value of multiTestKey1: ${multiValue1}`)
//   logger.info(`Value of multiTestKey2: ${multiValue2}`)

//   await redisClient.delKey('multiTestKey1')
//   await redisClient.delKey('multiTestKey2')
// }

// async function testCustomRedisCommands() {
//   logger.info('Testing custom Redis commands...')
//   await redisClient.client.defineCommand('echo', {
//     numberOfKeys: 0,
//     lua: 'return ARGV[1]'
//   })
//   const echoResult = await (redisClient.client as any).echo('Hello, Redis!')
//   logger.info(`Echo result: ${echoResult}`)
// }

// async function testTransactionOperations() {
//   logger.info('Testing transaction operations...')
//   await redisClient.addNewAvnTransaction('request1', 'hash1')
//   let txn = await redisClient.getAvnTransaction('hash1')
//   logger.info(`Transaction hash1: ${JSON.stringify(txn)}`)

//   await redisClient.addFailedAvnTransaction(
//     'request2',
//     'hash2',
//     'sender1',
//     'nonce1',
//     'failed'
//   )
//   txn = await redisClient.getAvnTransaction('hash2')
//   logger.info(`Transaction hash2: ${JSON.stringify(txn)}`)

//   await redisClient.updateTransactionStatusToPending(
//     'request3',
//     'hash3',
//     'sender2',
//     'nonce2'
//   )
//   txn = await redisClient.getAvnTransaction('hash3')
//   logger.info(`Transaction hash3: ${JSON.stringify(txn)}`)

//   await redisClient.resolvePendingAvnTransactions([
//     {
//       transactionHash: 'hash3',
//       status: 'Processed',
//       blockNumber: 123,
//       index: 1,
//       eventArgs: { some: 'data' }
//     }
//   ])
//   txn = await redisClient.getAvnTransaction('hash3')
//   logger.info(`Updated transaction hash3: ${JSON.stringify(txn)}`)
// }

// async function testRedisClientMethods() {
//   logger.info('Testing specific RedisClient methods...')
//   await redisClient.setNextNonce('senderAddress', 5)
//   let nonce = await redisClient.getNextNonce('senderAddress')
//   logger.info(`Next nonce for senderAddress: ${nonce}`)

//   await redisClient.setNextPayerNonce('payerAddress', 10)
//   nonce = await redisClient.getNextPayerNonce('payerAddress')
//   logger.info(`Next payer nonce for payerAddress: ${nonce}`)

//   await redisClient.setTotalToken('token1', 1000)
//   let totalToken = await redisClient.getTotalToken('token1')
//   logger.info(`Total token for token1: ${totalToken}`)

//   await redisClient.setRetrieveLowersFromAvnBlock(1500)
//   let blockNumber = await redisClient.getRetrieveLowersFromAvnBlock()
//   logger.info(`Retrieve lowers from AVN block: ${blockNumber}`)

//   await redisClient.setAutolowerNextT1Block(2000)
//   blockNumber = await redisClient.getAutolowerNextT1Block()
//   logger.info(`Autolower next T1 block: ${blockNumber}`)

//   await redisClient.addAutolower(3000)
//   let autolowers = await redisClient.getAutolowers()
//   logger.info(`Autolowers: ${autolowers.join(', ')}`)

//   await redisClient.removeAutolower(3000)
//   autolowers = await redisClient.getAutolowers()
//   logger.info(`Autolowers after removal: ${autolowers.join(', ')}`)
// }

// async function cleanUp() {
//   logger.info('Cleaning up test data...')
//   await redisClient.delKey('testKey')
//   await redisClient.delKey('testHashKey')
//   await redisClient.delKey('testSet')
//   await redisClient.delKey('multiTestKey1')
//   await redisClient.delKey('multiTestKey2')
//   await redisClient.delKey('echo')
//   await redisClient.delKey('request1')
//   await redisClient.delKey('request2')
//   await redisClient.delKey('request3')
//   await redisClient.delKey('senderAddress')
//   await redisClient.delKey('payerAddress')
//   await redisClient.delKey('token1')
//   await redisClient.delKey('1500')
//   await redisClient.delKey('2000')
//   await redisClient.delKey('3000')
// }

// runTests().catch(error => {
//   logger.error(`Unexpected error: ${error.message}`)
// })
