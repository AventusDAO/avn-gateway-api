const { SetupMode, SigningMode, NonceCacheType, NonceType } = require('avn-api');
const prompt = require('prompt-sync')({ sigint: true });
const helper = require('./helper.js');
const accounts = helper.ACCOUNTS;
const BN = helper.BN;
const { Keyring } = require('@polkadot/keyring');
const keyring = new Keyring({ type: 'sr25519', ss58Format: 42 });
const assert = require('chai').assert;

const relayer = accounts.relayer.address;
const ONE_TX_VALUE = new BN('100000000000000000');

function getUserSeedFromAddress(userAddress) {
  return Object.keys(accounts).flatMap(a => (accounts[a].address === userAddress ? [accounts[a].seed] : []))[0];
}

function addUserFromSeed(userSeed, index) {
  const user = keyring.addFromUri(userSeed);
  accounts[index] = {
    seed: userSeed,
    address: user.address
  };
}

async function signData(data, signerAddress) {
  const signerSuri = getUserSeedFromAddress(signerAddress);
  const signer = keyring.addFromUri(signerSuri);
  return signer.sign(data);
}

const signer = {
  sign: async (data, signerAddress) => {
    return await signData(data, signerAddress);
  }
};

const handleSplitFeeAccounts = nUsers => {
  console.log(`Please provide the seed of ${nUsers} split fee users.`);
  for (let i = 0; i < nUsers; i++) {
    let splitFeeAccountSeed = prompt(`User ${i + 1} seed: `);
    addUserFromSeed(splitFeeAccountSeed, i);
  }
};

const handleRemoteCache = () => {
  const TestNonceCacheProvider = require('./testRedisNonceCacheProvider');
  const testCacheProvider = new TestNonceCacheProvider();
  return {
    nonceCacheType: NonceCacheType.Remote,
    cacheProvider: testCacheProvider
  };
};

const sendUserTransactions = (api, nTxs) => {
  let requests = [];
  for (let i = 0; i < nTxs; i++) {
    requests.push(api.send.transferAvt(accounts.user.address, '1'));
  }
  return requests;
};

const createAccounts = (api, nUsers) => {
  for (let i = 0; i < nUsers; i++) {
    let newUserAccount = api.accountUtils.generateNewAccount();
    accounts[i] = newUserAccount;
    console.log(new Date(), ` - user account created: ${JSON.stringify(newUserAccount, null, 2)}`);
  }
};

const fundAccounts = async (apis, nUsers, nTxs) => {
  console.log(`\nFunding ${nUsers} account(s)\n`);
  let api = await apis.apis(accounts.user.address);
  // accounts.user.address has a reduced fee so don't use it
  const relayerFee = await api.query.getRelayerFees(relayer, accounts[0].address, 'proxyTokenTransfer');
  let gatewayFeePlusTransfer = new BN(relayerFee).add(new BN(nTxs)); // we transfer 1 wei
  let fundValue = new BN(nTxs).mul(gatewayFeePlusTransfer).mul(new BN(2)).add(ONE_TX_VALUE);
  for (let i = 0; i < nUsers; i++) {
    const requestId = await api.send.transferAvt(accounts[i].address, fundValue);
    await helper.confirmStatus(api.poll, requestId, 'Processed');
  }
};

const customConfirmStatus = async (pollApi, requestId) => {
  let response, status;
  for (i = 0; i < 300; i++) {
    await helper.sleep(1000);
    response = await pollApi.requestState(requestId);
    status = response.status;
    if (status !== 'Pending' && status !== 'AwaitingToSend' && status !== 'Transaction not found' && status !== undefined) {
      return response;
    }
  }
};

const pollTransactions = async (apis, transactionsToPoll) => {
  let api = await apis.apis(accounts.user.address);
  let requestResults = {
    success: {},
    failed: {}
  };

  for (let i = 0; i < transactionsToPoll.length; i++) {
    let requestId = transactionsToPoll[i].value;
    let pollResult = await customConfirmStatus(api.poll, requestId);
    requestResults[pollResult.status == 'Processed' ? 'success' : 'failed'][requestId] = pollResult;
    console.log(new Date(), `pollResult - Request: ${requestId} - ${JSON.stringify(pollResult.status)}`);
  }
  return requestResults;
};

const getProxyNonces = async (apis, nUsers, testInfo) => {
  let newTestInfo = testInfo;
  for (let i = 0; i < nUsers; i++) {
    let api = await apis.apis(accounts[i].address);
    const proxyNonce = (await api.proxyNonce(accounts[i].address, 'token'))?.nonce || 0;

    if (newTestInfo[i]?.proxyNonceBefore || newTestInfo[i]?.proxyNonceBefore === 0) {
      newTestInfo[i] = {
        ...newTestInfo[i],
        proxyNonceAfter: proxyNonce
      };
    } else {
      newTestInfo[i] = {
        address: accounts[i].address,
        proxyNonceBefore: proxyNonce
      };
    }
  }
  return newTestInfo;
};

const prepareAndSendTransactions = async (apis, nUsers, nTxs, testInfo) => {
  let newTestInfo = testInfo;
  const start = Date.now();
  let allTransactions = [];
  for (let i = 0; i < nUsers; i++) {
    let api = await apis.apis(accounts[i].address);
    // we deliberately do not use await to fire all transactions in parallel
    const userTxs = sendUserTransactions(api, nTxs);
    allTransactions.push(...userTxs);
  }

  const result = await Promise.allSettled(allTransactions);
  newTestInfo.successfulTx = result.filter(r => r.status === 'fulfilled');
  newTestInfo.failedTx = result.filter(r => r.status !== 'fulfilled');
  newTestInfo.completionTime = (Date.now() - start) / 1000;
  return newTestInfo;
};

async function setupUserAccounts(api, nUsers, nTxs, hasPayer) {
  if (!hasPayer) createAccounts(api, nUsers);
  await fundAccounts(api, nUsers, nTxs);
}

async function sendTransactions(api, nUsers, nTxs) {
  let testInfo = {
    successfulTx: [],
    failedTx: [],
    completionTime: 0
  };

  testInfo = await getProxyNonces(api, nUsers, testInfo);
  testInfo = await prepareAndSendTransactions(api, nUsers, nTxs, testInfo);
  testInfo = await getProxyNonces(api, nUsers, testInfo);
  return testInfo;
}

describe('Gateway multithreaded load test:', async () => {
  let api, results, pollResults, nUsers, nTxs, nonceCacheOptions, hasPayer;
  before(async () => {
    nUsers = parseInt(prompt('How many users? '));
    nTxs = parseInt(prompt('How many transactions per user? '));
    hasPayer = prompt('Has payer? yes/no(default): ') === 'yes';
    if (hasPayer) handleSplitFeeAccounts(nUsers);

    const logLevel = prompt('Log level? debug/info(default): ') === 'debug' ? 'debug' : 'info';
    const remoteCache = prompt('Remote cache? yes/no(default): ') === 'yes';
    nonceCacheOptions = remoteCache ? handleRemoteCache() : undefined;

    console.log(`\n*** Payload: ${nUsers} users sending ${nTxs} transactions each. ***`);
    console.log(`*** RemoteCache: ${remoteCache} | logLevel: ${logLevel}. ***\n`);

    api = await helper.avnApi({
      setupMode: SetupMode.MultiUser,
      signingMode: SigningMode.RemoteSigner,
      signer: signer,
      relayer,
      hasPayer: hasPayer,
      nonceCacheOptions,
      defaultLogLevel: logLevel
    });

    await setupUserAccounts(api, nUsers, nTxs, hasPayer);
  });

  describe('Sending transactions', async () => {
    before(async () => {
      results = await sendTransactions(api, nUsers, nTxs);
      pollResults = await pollTransactions(api, results.successfulTx);
    });

    it('Proxy nonces are correctly updated', async () => {
      for (let i = 0; i < nUsers; i++) {
        console.log(
          `Account: ${results[i].address} - Initial proxy nonce: ${results[i].proxyNonceBefore} - Final proxy nonce: ${results[i].proxyNonceAfter}`
        );
        assert.equal(results[i].proxyNonceBefore + (nTxs - 1), results[i].proxyNonceAfter, `Proxy nonces do not match`);
      }
    });

    it('All transactions were successfully sent', async () => {
      assert.equal(results.successfulTx.length, nUsers * nTxs);
    });

    it('Zero failed transactions', async () => {
      if (results.failedTx.length > 0) console.log(`Failed transactions: ${JSON.stringify(results.failedTx, null, 2)}`);
      assert.equal(results.failedTx.length, 0);
    });

    it('All transactions were processed successfully', async () => {
      assert.equal(Object.values(pollResults.success).length, nUsers * nTxs);
    });

    it('Zero rejected transactions', async () => {
      if (pollResults.failed.length > 0) console.log(`Rejected transactions: ${JSON.stringify(pollResults.failed, null, 2)}`);
      assert.equal(Object.values(pollResults.failed).length, 0);
    });
  });

  describe('Nonce recovery', async () => {
    let testInfo = {
      successfulTx: [],
      failedTx: [],
      completionTime: 0
    };

    before(async () => {
      if (!hasPayer && !accounts[0]) {
        createAccounts(api, nUsers);
        await fundAccounts(api, nUsers, nTxs);
      }
    });

    it('Can recover if nonce is locked in remote cache database', async () => {
      const gatewayApi = await api.apis(accounts[0].address);

      // Lock the token nonce for all users
      for (let i = 0; i < nUsers; i++) {
        await gatewayApi.send.api.nonceCache.setNonceCacheForUserIfRequired(accounts[i].address);
        await gatewayApi.send.api.nonceCache.lockNonce(accounts[i].address, NonceType.Token, `TestRequestId-${i}`);
      }

      testInfo = await sendTransactions(api, nUsers, nTxs);

      // Check if all transactions have been sent successfuly
      for (let i = 0; i < nUsers; i++) {
        console.log(
          `Account: ${testInfo[i].address} - Initial proxy nonce: ${testInfo[i].proxyNonceBefore} - Final proxy nonce: ${testInfo[i].proxyNonceAfter}`
        );
        assert.equal(parseInt(testInfo[i].proxyNonceBefore) + nTxs, testInfo[i].proxyNonceAfter, `Proxy nonces must be equal`);
      }

      assert.equal(testInfo.successfulTx.length, nUsers * nTxs, `Some transactions failed to be sent successfully`);

      const pollResult = await pollTransactions(api, testInfo.successfulTx);
      assert.equal(
        Object.values(pollResult.success).length,
        nUsers * nTxs,
        `Some transactions failed to be executed successfully (found ${Object.values(pollResult.success).length} txs)`
      );
      if (pollResult.failed.length > 0) console.log(`Rejected transactions: ${JSON.stringify(pollResult.failed, null, 2)}`);
      assert.equal(Object.values(pollResult.failed).length, 0, `Some transactions failed to be executed successfully`);
    });
  });
});
