const assert = require('chai').assert;
const helper = require('./helper.js');
const accounts = helper.ACCOUNTS;
const BN = helper.BN;
const bnEquals = helper.bnEquals;
const AvnApi = require('../index.js');

describe('Split fees calls:', async () => {
  let api;
  let token;
  let relayer, user, recipient;
  let relayerFee;

  before(async () => {
    api = await helper.avnApi();
    token = helper.token;
    relayer = accounts.relayer.address;
    user = accounts.user.address;
    recipient = accounts.otherUser.address;
    payer = accounts.payer.address;
    recipientPubKey = accounts.otherUser.publicKey;
    relayerFee = new BN((await api.query.getRelayerFees(relayer, user)).proxyAvtTransfer);
  });

  describe('Split fees', async () => {
    let userAvtBalanceBefore, recipientAvtBalanceBefore, relayerAvtBalanceBefore, options;

    beforeEach(async () => {
      userAvtBalanceBefore = new BN(await api.query.getAvtBalance(user));
      recipientAvtBalanceBefore = new BN(await api.query.getAvtBalance(recipient));
      relayerAvtBalanceBefore = new BN(await api.query.getAvtBalance(relayer));
      payerAvtBalanceBefore = new BN(await api.query.getAvtBalance(payer));
      options = {
        suri: accounts.user.seed,
      }
    });

    it ('Account valid payer correctly pays for gateway fees', async () => {
        let validOptions = {...options, hasPayer: true, payerAddress: payer};
        const apiWithOptions = new AvnApi(null, validOptions);
        await apiWithOptions.init();

        const amount = new BN(1);
        const requestId = await apiWithOptions.send.transferAvt(relayer, recipient, amount);
        await helper.confirmStatus(apiWithOptions, requestId, 'Processed');

        bnEquals(recipientAvtBalanceBefore.add(amount), await api.query.getAvtBalance(recipient));
        bnEquals(userAvtBalanceBefore.sub(relayerFee).sub(amount), new BN(await api.query.getAvtBalance(user)));
        bnEquals(new BN(await api.query.getAvtBalance(relayer)).gte(relayerAvtBalanceBefore.add(relayerFee)));
        bnEquals(new BN(await api.query.getAvtBalance(payer)).gte(payerAvtBalanceBefore)); // add payer fee
        // do we know how much does the gateway payer is
    });

    it ('Account default added valid payer correctly pays for gateway fees', async () => {
        let validOptions = {...options, hasPayer: true}
        const apiWithOptions = new AvnApi(null, validOptions);
        await apiWithOptions.init();

        const amount = new BN(1);
        const requestId = await apiWithOptions.send.transferAvt(relayer, recipient, amount);
        await helper.confirmStatus(apiWithOptions, requestId, 'Processed');

        bnEquals(recipientAvtBalanceBefore.add(amount), await api.query.getAvtBalance(recipient));
        bnEquals(userAvtBalanceBefore.sub(relayerFee).sub(amount), new BN(await api.query.getAvtBalance(user)));
        bnEquals(new BN(await api.query.getAvtBalance(relayer)).gte(relayerAvtBalanceBefore.add(relayerFee)));
        bnEquals(new BN(await api.query.getAvtBalance(payer)).gte(payerAvtBalanceBefore)); // add payer fee
        // do we know how much does the gateway payer is
    });

    it ('hasPayer flag false and valid payerAddress', async () => {
        let invalidOptions = {...options, hasPayer: false, payerAddress: payer};
        const apiWithOptions = new AvnApi(null, invalidOptions);
        await apiWithOptions.init();

        const requestId = await apiWithOptions.send.transferAvt(relayer, recipient, amount);
        await helper.confirmStatus(apiWithOptions, requestId, 'Processed');

        bnEquals(recipientAvtBalanceBefore.add(amount), await api.query.getAvtBalance(recipient));
        bnEquals(userAvtBalanceBefore.sub(relayerFee).sub(amount), new BN(await api.query.getAvtBalance(user)));
        bnEquals(new BN(await api.query.getAvtBalance(relayer)).gte(relayerAvtBalanceBefore.add(relayerFee)));
        bnEquals(new BN(await api.query.getAvtBalance(payer)).gte(payerAvtBalanceBefore)); // add payer fee
        // do we know how much does the gateway payer is
    });

    // if I provide a payer address which is invalid and this account has another valid account but not specified here
    // what happens
    it ('incorrect account payer returns an error', async () => {
        let invalidPayer = recipient;
        let invalidOptions = {...options, hasPayer: true, payerAddress: invalidPayer};
        const apiWithOptions = new AvnApi(null, invalidOptions);
        await apiWithOptions.init();

        const requestId = await apiWithOptions.send.transferAvt(relayer, recipient, amount);
        await helper.confirmStatus(apiWithOptions, requestId, 'Rejected');
    });

    it ('Valid payer address but invalid extrinsic', async () => {
        let invalidOptions = {...options, hasPayer: true, payerAddress: payer};
        const apiWithOptions = new AvnApi(null, invalidOptions);
        await apiWithOptions.init();

        // change this extrinsic or the payer when we have this fixed
        const requestId = await apiWithOptions.send.transferAvt(relayer, recipient, amount);
        await helper.confirmStatus(apiWithOptions, requestId, 'Rejected');
    });
  });
});
