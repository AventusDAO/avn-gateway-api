const {AvnApi, SetupMode, SigningMode, NonceCacheType} = require('avn-api');
const TestNonceCacheProvider = require("./testRedisNonceCacheProvider");

const { gateway } = require(`../config/environments/parachainUAT.json`);
const { accounts } = require(`../config/accounts/parachainUAT.json`);

const { Keyring } = require('@polkadot/keyring');
const keyring = new Keyring({ type: 'sr25519', ss58Format: 42 });

async function avnApi(options) {
  options = options ?? {};
  const api = new AvnApi(gateway, options);
  await api.init();
  return api;
}

function getUserSeedFromAddress(userAddress) {
  return Object.keys(accounts).flatMap(a => accounts[a].address === userAddress ? [accounts[a].seed] : [])[0]
}

async function signData(data, signerAddress) {
  const signerSuri = getUserSeedFromAddress(signerAddress);
  const signer = keyring.addFromUri(signerSuri);
  return signer.sign(data);
}

const signer = {
  sign: async (data, signerAddress) => {
    return await signData(data, signerAddress)
  }
};

async function sendTransactions() {
  const testCacheProvider = new TestNonceCacheProvider();
  let api = await avnApi({
      //suri: accounts.nahu.seed,
      signer: signer,
      hasPayer: true,
      setupMode : SetupMode.MultiUser,
      signingMode: SigningMode.RemoteSigner,
      nonceCacheOptions: {
        nonceCacheType: NonceCacheType.Remote,
        cacheProvider: testCacheProvider,
      },
      defaultLogLevel: 'debug'
  });

  let apis = await api.apis(accounts.nahu.address)

  const start = Date.now();

  // for (let i = 0; i < 250; i++)
  // {
  //   console.log(`Sending tx ${i}`)
  //   try {
  //     await apis.send.transferAvt(accounts.user.address, '1');
  //   } catch (err) {
  //     console.log(err)
  //   }

  // }

  // console.log(`\n\n`)
  // apis = await api.apis(accounts.user.address);
  // for (let i = 0; i < 200; i++)
  // {
  //   console.log(`Sending tx ${i}`)
  //   try {
  //     await apis.send.transferAvt(accounts.otherUser.address, '1');
  //   } catch (err) {
  //     console.log(err)
  //   }
  // }

  // console.log(`\n\n`)
  // apis = await api.apis(accounts.otherUser.address);
  // for (let i = 0; i < 100; i++)
  // {
  //   console.log(`Sending tx ${i}`)
  //   try {
  //     await apis.send.transferAvt(accounts.nahu.address, '1');
  //   } catch (err) {
  //     console.log(err)
  //   }
  // }

  const sendRequests = []
  for (let i = 0; i < 1000; i++)
  {
    sendRequests.push(apis.send.transferAvt(accounts.user.address, '1'));
  }

  apis = await api.apis(accounts.user.address);
  for (let i = 0; i < 3000; i++)
  {
    sendRequests.push(apis.send.transferAvt(accounts.otherUser.address, '1'));
  }

  apis = await api.apis(accounts.otherUser.address);
  for (let i = 0; i < 2000; i++)
  {
    sendRequests.push(apis.send.transferAvt(accounts.nahu.address, '1'));
  }

  const result = await Promise.allSettled(sendRequests);

  console.log("Result: ", (Date.now() - start) / 1000);
  const success = result.filter(r => r.status === 'fulfilled');
  console.log("Success: ", success.length);
  const failure = result.filter(r => r.status !== 'fulfilled');
  console.log("Failed: ", failure.length, "\n", failure);

  console.log("\nCurrent proxy nonce - nahu: ", (await apis.proxyNonce(accounts.nahu.address, 'token')).nonce)
  console.log("\nCurrent proxy nonce - otherUser: ", (await apis.proxyNonce(accounts.otherUser.address, 'token')).nonce)
  console.log("\nCurrent proxy nonce - user: ", (await apis.proxyNonce(accounts.user.address, 'token')).nonce)

  process.exit(0)
}

sendTransactions()




