const AvnApi = require('avn-api');
const assert = require('chai').assert;
const helper = require('./helper.js');
const accounts = helper.ACCOUNTS;
const BN = helper.BN;
const bnEquals = helper.bnEquals;
const ONE_AVT = new BN('1000000000000000000');

const { Keyring } = require('@polkadot/keyring');
const keyring = new Keyring({ type: 'sr25519', ss58Format: 42 });

describe('Access rights:', async () => {
  let singleUserApi, multiUserApi;
  let relayer;

  async function canAccessTheGateway(api) {
    try {
      console.log("\nTest: ")
      // Any call which actually accesses the gateway (ie: is not cached in the api object) will do here
      console.log(` - Result: ${await api.getTotalAvt()}`);
    } catch (e) {
      console.log("ERROR: ", e)
      return false;
    }
    return true;
  }

  function getUserSeedFromAddress(userAddress) {
    return Object.keys(accounts).flatMap(a => accounts[a].address === userAddress ? [accounts[a].seed] : [])[0]
  }

  async function signData(data, signerAddress) {
    const signerSuri = getUserSeedFromAddress(signerAddress);
    const signer = keyring.addFromUri(signerSuri);
    return signer.sign(data);
  }

  before(async () => {
    //relayer = accounts.relayer.address;
    user = accounts.user.address;
    userSURI = accounts.user.seed;


    singleUserApi = (await helper.avnApi({
      suri: accounts.user.seed,
      relayer: relayer,
      setupMode : AvnApi.SetupMode.SingleUser,
      signingMode: AvnApi.SigningMode.SuriBased
    })).apis();


    //setupMode
    const signer = {
      sign: async (data, signerAddress) => {
        return await signData(data, signerAddress)
      }
    };

    multiUserApi = await helper.avnApi({
      signer: signer,
      relayer: relayer,
      setupMode : AvnApi.SetupMode.MultiUser,
      signingMode: AvnApi.SigningMode.RemoteSigner
    });

    console.log("\nSingle user api: ", singleUserApi)
    console.log("\n\nMulti user api: ", multiUserApi)
    console.log("\n\n\n\n")

  });

  describe('Nahu', async () => {
    it('can query', async () => {
      console.log("\n single user")
      let userApi = singleUserApi.query;
      await canAccessTheGateway(userApi)

      console.log("\n mutli user")
      userApi = multiUserApi.apis(accounts.user.address).query;
      await canAccessTheGateway(userApi)

      userApi = multiUserApi.apis(accounts.otherUser.address).query;
      await canAccessTheGateway(userApi)

      userApi = multiUserApi.apis(accounts.payer.address).query;
      await canAccessTheGateway(userApi)

      userApi = multiUserApi.apis(accounts.otherUser.address).query;
      await canAccessTheGateway(userApi)

      console.log("Using the same signer for multiple tests")
      userApi = multiUserApi.apis(accounts.user.address).query;
      await canAccessTheGateway(userApi)
      await canAccessTheGateway(userApi)
      // await helper.sleep(600000);
      // await canAccessTheGateway(userApi)
    });

    it('can send and poll', async () => {
      const amount = new BN(1);
      let recipient = accounts.otherUser.address;

      console.log("\n single user")
      let requestId = await singleUserApi.send.transferAvt(recipient, amount);
      await helper.confirmStatus_new(singleUserApi.poll, requestId, 'Processed');

      let requestIds = []

      console.log("\n\n mutli user")
      let apis = multiUserApi.apis(accounts.user.address);

      console.log("\nTransfer 1")
      requestIds.push(await apis.send.transferAvt(recipient, amount));
      console.log("\nTransfer 2")
      requestIds.push(await apis.send.transferAvt(recipient, amount));

      console.log(`\n\n *** Switching users*** \n\n `)

      apis = multiUserApi.apis(accounts.otherUser.address);
      recipient = accounts.user.address;

      console.log("\nTransfer 3")
      requestIds.push(await apis.send.transferAvt(recipient, amount));
      console.log("\nTransfer 4")
      requestIds.push(await apis.send.transferAvt(recipient, amount));

      console.log(`\n\n *** Switching users*** \n\n `)

      apis = multiUserApi.apis(accounts.user.address);
      recipient = accounts.otherUser.address;

      console.log("\nTransfer 5")
      requestIds.push(await apis.send.transferAvt(recipient, amount));
      console.log("\nTransfer 6")
      requestIds.push(await apis.send.transferAvt(recipient, amount));
      console.log("\n")

      for (const r of requestIds) {
        console.log("R: ", r)
        await helper.confirmStatus_new(apis.poll, r, 'Processed');
      }


    });

  });
});
