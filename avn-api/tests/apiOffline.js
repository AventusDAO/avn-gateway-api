const AvnApi = require('avn-api');
const assert = require('chai').assert;
const helper = require('./helper.js');

describe('Access rights:', async () => {
  let api;

  describe('Offline mode', async () => {
    it('api is initializable', async () => {
      const api = new AvnApi();
      await api.init();
    });
  });
});
