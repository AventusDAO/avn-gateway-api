const { SetupMode, SigningMode, NonceCacheType } = require('avn-api');
const chai = require('chai');
chai.use(require('chai-as-promised'));

const expect = chai.expect;
const assert = chai.assert;
const helper = require('./helper.js');
const accounts = helper.ACCOUNTS;
const BN = helper.BN;
const bnEquals = helper.bnEquals;
const ONE_AVT = new BN('1000000000000000000');

class TestNonceCacheProvider {
  constructor() {}
  async connect() {}
  async initUserNonceCache(signerAddress) {}
  async getNonceData(signerAddress, nonceType) {}
  async getNonceAndLock(signerAddress, nonceType) {}
  async incrementNonce(lockId, signerAddress, nonceType, updateLastUpdate) {}
  async unlockNonce(signerAddress, nonceType) {}
  async setNonce(lockId, signerAddress, nonceType, nonce) {}
}

describe('Access rights:', async () => {
  let multiUserApi, api;
  let relayer, user, userSURI, newUser, newUserSURI, existingUserTestAccount, existingUser, existingUserSURI;

  async function canAccessTheGateway(api) {
    try {
      // Any call which actually accesses the gateway (ie: is not cached in the api object) will do here
      await api.query.getTotalAvt();
    } catch (e) {
      return false;
    }
    return true;
  }

  const signer = {
    sign: async (data, signerAddress) => {
      return await helper.remoteSigner(data, signerAddress, accounts);
    }
  };

  describe('setOptions', async () => {
    it('default options work', async () => {
      const options = {
        suri: accounts.user.seed
      };
      const avnGateway = await helper.avnApi(options);

      assert.equal(avnGateway.options.setupMode, SetupMode.SingleUser);
      assert.equal(avnGateway.options.signingMode, SigningMode.SuriBased);
      assert.equal(avnGateway.options.nonceCacheOptions.nonceCacheType, NonceCacheType.Local);
      assert.equal(avnGateway.options.defaultLogLevel, 'info');
    });

    it('can set a relayer', async () => {
      const options = {
        suri: accounts.user.seed,
        relayer: accounts.user.address // invalid relayer
      };

      const avnGateway = await helper.avnApi(options);
      const api = await avnGateway.apis();

      // This fails because we are able to set a relayer. Although its a bad one.
      await expect(api.send.transferAvt(accounts.otherUser.address, '1')).to.be.rejected;
    });

    describe('Log level', async () => {
      it('can set a log level', async () => {
        const options = {
          suri: accounts.user.seed,
          defaultLogLevel: 'warn'
        };
        const avnGateway = await helper.avnApi(options);
        assert.equal(avnGateway.options.defaultLogLevel, 'warn');
      });

      it('log level is validated', async () => {
        const badLevel = 'foo';
        const options = {
          suri: accounts.user.seed,
          defaultLogLevel: badLevel
        };

        await expect(helper.avnApi(options)).to.be.rejectedWith(`log.setLevel() called with invalid level: ${badLevel}`);
      });
    });

    describe('Setup mode', async () => {
      it('can set a single user setup', async () => {
        const options = {
          suri: accounts.user.seed,
          setupMode: SetupMode.SingleUser
        };

        const avnGateway = await helper.avnApi(options);
        assert.equal(avnGateway.options.setupMode, SetupMode.SingleUser);
      });

      it('validates single user setup', async () => {
        const options = {
          suri: accounts.user.seed,
          setupMode: 'foo'
        };

        await expect(helper.avnApi(options)).to.be.rejectedWith(`setup mode must be defined`);
      });

      it('can set a multi user setup', async () => {
        const options = {
          signer,
          setupMode: SetupMode.MultiUser,
          signingMode: SigningMode.RemoteSigner
        };

        const avnGateway = await helper.avnApi(options);
        assert.equal(avnGateway.options.setupMode, SetupMode.MultiUser);
      });

      it('validates multi user setup', async () => {
        const options = {
          suri: accounts.user.seed,
          setupMode: SetupMode.MultiUser
        };

        await expect(helper.avnApi(options)).to.be.rejectedWith(`In multi user mode, you must use a remote signer`);
      });

      it('validates offline mode', async () => {
        const options = {
          setupMode: SetupMode.Offline
        };

        const avnGateway = await helper.avnApi(options);
        assert.equal(avnGateway.options.setupMode, SetupMode.Offline);
      });
    });

    describe('Signing mode', async () => {
      it('can set a remote signer', async () => {
        // update options.signer to include a new property called avnAddress

        const newSigner = {
          sign: signer.sign,
          address: accounts.user.address
        };

        const options = {
          signer: newSigner,
          signingMode: SigningMode.RemoteSigner
        };

        const avnGateway = await helper.avnApi(options);
        assert.equal(avnGateway.options.signingMode, SigningMode.RemoteSigner);
      });

      it('can validate remote signer', async () => {
        const options = {
          suri: accounts.user.seed,
          signingMode: SigningMode.RemoteSigner
        };

        await expect(helper.avnApi(options)).to.be.rejectedWith(`In remote signer mode, a suri must not be specified`);
      });

      it('can set a suri based signer', async () => {
        const options = {
          suri: accounts.user.seed,
          signingMode: SigningMode.SuriBased
        };

        const avnGateway = await helper.avnApi(options);
        assert.equal(avnGateway.options.signingMode, SigningMode.SuriBased);
      });

      it('can validate suri based signer', async () => {
        const options = {
          signer,
          signingMode: SigningMode.SuriBased
        };

        await expect(helper.avnApi(options)).to.be.rejectedWith(`In suri mode, a remote signer must not be specified`);
      });

      it('can validate signing mode', async () => {
        const options = {
          signer,
          signingMode: 'foo'
        };

        await expect(helper.avnApi(options)).to.be.rejectedWith(`Signing mode must be defined`);
      });
    });

    describe('Nonce cache', async () => {
      it('can set a local cache', async () => {
        const options = {
          suri: accounts.user.seed,
          nonceCacheOptions: {
            nonceCacheType: NonceCacheType.Local
          }
        };

        const avnGateway = await helper.avnApi(options);
        assert.equal(avnGateway.options.nonceCacheOptions.nonceCacheType, NonceCacheType.Local);
      });

      it('can set a remote cache', async () => {
        const testCacheProvider = new TestNonceCacheProvider();
        const options = {
          suri: accounts.user.seed,
          nonceCacheOptions: {
            cacheProvider: testCacheProvider,
            nonceCacheType: NonceCacheType.Remote
          }
        };

        const avnGateway = await helper.avnApi(options);
        assert.equal(avnGateway.options.nonceCacheOptions.nonceCacheType, NonceCacheType.Remote);
      });

      it('can validate remote cache mode', async () => {
        const options = {
          suri: accounts.user.seed,
          nonceCacheOptions: {
            nonceCacheType: NonceCacheType.Remote
          }
        };

        await expect(helper.avnApi(options)).to.be.rejectedWith(
          `With a remote cache, you must specify a cache provider interface that implements an INonceCacheProvider`
        );
      });
    });

    describe('Split fee', async () => {
      it('can set blank payer', async () => {
        const options = {
          suri: accounts.user.seed,
          hasPayer: true
        };

        const avnGateway = await helper.avnApi(options);
        assert.equal(avnGateway.options.hasPayer, true);
      });

      it('can set a payer address', async () => {
        const options = {
          suri: accounts.user.seed,
          hasPayer: true,
          payerAddress: accounts.bank.address // invalid payer
        };

        const avnGateway = await helper.avnApi(options);
        const api = await avnGateway.apis();

        await expect(api.send.transferAvt(accounts.otherUser.address, '1')).to.be.rejectedWith(
          `Request failed with status code 403`
        );
      });
    });
  });
});
