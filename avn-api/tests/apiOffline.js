const {AvnApi} = require('avn-api');
const assert = require('chai').assert;
const helper = require('./helper.js');

describe('Access rights:', async () => {
  let api;

  describe('Offline mode', async () => {
    it('api is initializable', async () => {
      const undefinedGateway = undefined;
      const api = new AvnApi(undefinedGateway, {
        suri: helper.ACCOUNTS.user.seed
      });
      await api.init();
    });

    it('utils work', async () => {
      const undefinedGateway = undefined;
      const api = new AvnApi(undefinedGateway, {
        suri: helper.ACCOUNTS.user.seed
      });
      await api.init();

      const newAccount = api.accountUtils.generateNewAccount();
      assert(newAccount.mnemonic.length > 0);
      assert(newAccount.seed.startsWith('0x'));
    });
  });
});
