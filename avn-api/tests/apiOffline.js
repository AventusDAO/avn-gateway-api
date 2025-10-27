const { SetupMode, AvnApi } = require('avn-api');
const assert = require('chai').assert;

describe('Access rights:', async () => {
  describe('Offline mode', async () => {
    it('api is initializable', async () => {
      const undefinedGateway = undefined;
      const api = new AvnApi(undefinedGateway, {
        setupMode: SetupMode.Offline
      });
      await api.init();
    });

    it('account utils work', async () => {
      const undefinedGateway = undefined;
      const api = new AvnApi(undefinedGateway, {
        setupMode: SetupMode.Offline
      });
      await api.init();

      const newAccount = api.accountUtils.generateNewAccount();
      assert(newAccount.mnemonic.length > 0);
      assert(newAccount.seed.startsWith('0x'));
    });

    it('Awt and proxy utils are not exposed', async () => {
      const undefinedGateway = undefined;
      const api = new AvnApi(undefinedGateway, {
        setupMode: SetupMode.Offline
      });
      await api.init();

      assert(api.awtUtils === undefined);
      assert(api.proxyUtils === undefined);
    });
  });
});
