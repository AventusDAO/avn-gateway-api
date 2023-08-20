const {SetupMode, SigningMode, NonceCacheType} = require('avn-api');
const prompt = require("prompt-sync")({ sigint: true });
const helper = require('./helper.js');
const accounts = helper.ACCOUNTS;
const BN = helper.BN;
const { Keyring } = require('@polkadot/keyring');
const keyring = new Keyring({ type: 'sr25519', ss58Format: 42 });
const assert = require('chai').assert;

const ONE_TX_VALUE = new BN('100000000000000000');

function getUserSeedFromAddress(userAddress) {
  return Object.keys(accounts).flatMap(a => accounts[a].address === userAddress ? [accounts[a].seed] : [])[0];
}

function addUserFromSeed(userSeed, index) {
  const user = keyring.addFromUri(userSeed);
  accounts[index] = {
    seed: userSeed,
    address: user.address
  }
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

const handleSplitFeeAccounts = (nUsers) => {
  for (let i = 0; i < nUsers; i++) {
    console.log(`Please provide the seed of ${nUsers} split fee users.`);
    let splitFeeAccountSeed = prompt(`User ${i + 1} seed: `);
    addUserFromSeed(splitFeeAccountSeed, i);
  }
}

const handleRemoteCache = () => {
  const TestNonceCacheProvider = require("./testRedisNonceCacheProvider");
  const testCacheProvider = new TestNonceCacheProvider();
  return {
    nonceCacheType: NonceCacheType.Remote,
    cacheProvider: testCacheProvider,
  }
}

const sendUserTransactions = (apis, nTxs) => {
  let requests = [];
  for (let i = 0; i < nTxs; i++) {
    requests.push(apis.send.transferAvt(accounts.user.address, '1'));
  }
  return requests;
}

const createAccounts = (api, nUsers) => {
  for (let i = 0; i < nUsers; i++) {
    let newUserAccount = api.accountUtils.generateNewAccount();
    accounts[i] = newUserAccount;
    console.log(`user account created: ${JSON.stringify(newUserAccount, null, 2)}`);
  }
}

const fundAccounts = async (api, nUsers, nTxs) => {
  let fundValue = new BN(nTxs).mul(ONE_TX_VALUE);
  for (let i = 0; i < nUsers; i++) {
    let apis = await api.apis(accounts.user.address);
    const requestId = await apis.send.transferAvt(accounts[i].address, fundValue);
    await helper.confirmStatus(apis.poll, requestId, 'Processed');
  }
}

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
}

const pollTransactions = async (api, transactionsToPoll) => {
  let apis = await api.apis(accounts.user.address);
  let requestResults = {
    success: {},
    failed: {}
  };

  for (let i = 0; i < transactionsToPoll.length; i++) {
    let requestId = transactionsToPoll[i].value;
    let pollResult = await customConfirmStatus(apis.poll, requestId);
    requestResults[pollResult.status == 'Processed' ? 'success' : 'failed'][requestId] = pollResult;
    console.log(`pollResult - Request: ${requestId} - ${JSON.stringify(pollResult.status)}`)
  }
  return requestResults;
}

const getProxyNonces = async (api, nUsers, testInfo) => {
  let newTestInfo = testInfo;
  for (let i = 0; i < nUsers; i++) {
    let apis = await api.apis(accounts[i].address);
    const proxyNonce = (await apis.proxyNonce(accounts[i].address, 'token'))?.nonce || 0;

    if (newTestInfo[i]?.proxyNonceBefore || newTestInfo[i]?.proxyNonceBefore === 0) {
      newTestInfo[i] = {
        ...newTestInfo[i],
        proxyNonceAfter: proxyNonce
      }
    } else {
      newTestInfo[i] = {
        address: accounts[i].address,
        proxyNonceBefore: proxyNonce
      }
    }
  }
  return newTestInfo;
}

const prepareAndSendTransactions = async (api, nUsers, nTxs, testInfo) => {
  let newTestInfo = testInfo;
  const start = Date.now();
  let allTransactions = [];
  for (let i = 0; i < nUsers; i++) {
    let apis = await api.apis(accounts[i].address);
    const userTxs = sendUserTransactions(apis, nTxs);
    allTransactions.push(...userTxs);
  }

  const result = await Promise.allSettled(allTransactions);
  newTestInfo.successfulTx = result.filter(r => r.status === 'fulfilled');
  newTestInfo.failedTx = result.filter(r => r.status !== 'fulfilled');
  newTestInfo.completionTime = (Date.now() - start) / 1000;
  return newTestInfo;
}

async function sendTransactions(api, nUsers, nTxs, hasPayer) {
  let testInfo = {
    successfulTx: [],
    failedTx: [],
    completionTime: 0
  };

  if (!hasPayer) createAccounts(api, nUsers);
  await fundAccounts(api, nUsers, nTxs);

  testInfo = await getProxyNonces(api, nUsers, testInfo);
  testInfo = await prepareAndSendTransactions(api, nUsers, nTxs, testInfo);
  testInfo = await getProxyNonces(api, nUsers, testInfo);
  return testInfo;
}

describe('Gateway multithreaded load test:', async () => {
  let api, results, pollResults, nUsers, nTxs, nonceCacheOptions, hasPayer;
  before(async () => {
    nUsers = parseInt(prompt("How many users? "));
    nTxs = parseInt(prompt("How many transactions per user? "));
    hasPayer = prompt("Has payer? yes/no(default): ") === 'yes';
    if(hasPayer) handleSplitFeeAccounts(nUsers);

    const logLevel = prompt("Log level? debug/info(default): ") === 'debug' ? 'debug' : 'info';
    const remoteCache = prompt("Local cache? yes/no(default): ") === 'yes';
    nonceCacheOptions = remoteCache ? handleRemoteCache() : undefined;

    console.log(`*** Payload: ${nUsers} users sending ${nTxs} transactions each. ***`);
    console.log(`*** RemoteCache: ${remoteCache} | logLevel: ${logLevel}. ***`);

    api = await helper.avnApi({
      setupMode : SetupMode.MultiUser,
      signingMode: SigningMode.RemoteSigner,
      signer: signer,
      hasPayer: hasPayer,
      nonceCacheOptions,
      defaultLogLevel: logLevel,
    });
  });

  describe('Sending transactions', async () => {
    before(async () => {
      results = await sendTransactions(api, nUsers, nTxs, hasPayer);
    });

    it('Proxy nonces are correctly updated', async () => {
      for (let i = 0; i < nUsers; i++) {
        console.log(`Account: ${results[i].address} - Initial proxy nonce: ${results[i].proxyNonceBefore} - Final proxy nonce: ${results[i].proxyNonceAfter}`);
        assert.equal(results[i].proxyNonceBefore + (nTxs - 1), results[i].proxyNonceAfter);
      }
    });

    it('All transactions were successfully sent', async () => {
      assert.equal(results.successfulTx.length, nUsers * nTxs);
    });

    it('Zero failed transactions', async () => {
      if(results.failedTx.length > 0) console.log(`Failed transactions: ${JSON.stringify(results.failedTx, null, 2)}`);
      assert.equal(results.failedTx.length, 0);
    });
  });

  describe('Polling transactions', async () => {
    before(async () => {
      pollResults = await pollTransactions(api, results.successfulTx);
    });

    it('All transactions were processed successfully', async () => {
      assert.equal(Object.values(pollResults.success).length, nUsers * nTxs);
    });

    it('Zero rejected transactions', async () => {
      if(pollResults.failed.length > 0) console.log(`Rejected transactions: ${JSON.stringify(pollResults.failed, null, 2)}`);
      assert.equal(Object.values(pollResults.failed).length, 0);
    });
  });
});