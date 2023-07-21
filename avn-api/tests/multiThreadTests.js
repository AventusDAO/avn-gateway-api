const {AvnApi, SetupMode, SigningMode, NonceCacheType} = require('avn-api');
const TestNonceCacheProvider = require("./testNonceCacheProvider");

const { gateway } = require(`../config/environments/parachainUAT.json`);
const { accounts } = require(`../config/accounts/parachainUAT.json`);

async function avnApi(options) {
  options = options ?? {};
  const api = new AvnApi(gateway, options);
  await api.init();
//  console.log("\nApi: ", api)
  return await api.apis();
}

async function sendTransactions() {
  const testCacheProvider = new TestNonceCacheProvider();
  const apis = await avnApi({
      suri: accounts.nahu.seed,
      //hasPayer: true,
      setupMode : SetupMode.SingleUser,
      signingMode: SigningMode.SuriBased,
      nonceCacheType: NonceCacheType.Remote,
      cacheProvider: testCacheProvider
  });

  console.log("\nApi: ", (await apis.proxyNonce(accounts.nahu.address, 'token')).nonce)

  const sendRequests = []
  for (let i = 0; i < 10; i++)
  {
    sendRequests.push(apis.send.transferAvt(accounts.otherUser.address, '1'));
  }

  const result = await Promise.allSettled(sendRequests);
  console.log("Result: ", result);
}

sendTransactions()




