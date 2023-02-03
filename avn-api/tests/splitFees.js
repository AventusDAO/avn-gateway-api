const chai = require('chai');
const expect = chai.expect;
const assert = chai.assert;
const helper = require('./helper.js');
const accounts = helper.ACCOUNTS;
const BN = helper.BN;
const bnEquals = helper.bnEquals;
const AvnApi = require('../index.js');


// TODO add setup script to remove hardcoded values


describe('Split fees calls:', async () => {
  let api;
  let token;
  let relayer, user, recipient;
  let relayerFee;
  let amountInWei;
  let amount;

  before(async () => {
    api = await helper.avnApi();
    token = helper.token;
    relayer = accounts.relayer.address;
    user = accounts.user.address;
    recipient = accounts.otherUser.address;
    payer = accounts.relayer.address;
    payerPubKey = accounts.relayer.publicKey;
    recipientPubKey = accounts.otherUser.publicKey;
    amountInWei = new BN(helper.TEN_THOUSAND_WEI);
    amount = new BN(1);
    relayerFee = new BN((await api.query.getRelayerFees(relayer, user)).proxyAvtTransfer);
  });

  describe('Split fees', async () => {
    let userAvtBalanceBefore, recipientAvtBalanceBefore, relayerAvtBalanceBefore, payerAvtBalanceBefore, options, payerPaymentNonce;

    beforeEach(async () => {
      userAvtBalanceBefore = new BN(await api.query.getAvtBalance(user));
      recipientAvtBalanceBefore = new BN(await api.query.getAvtBalance(recipient));
      relayerAvtBalanceBefore = new BN(await api.query.getAvtBalance(relayer));
      payerAvtBalanceBefore = new BN(await api.query.getAvtBalance(payer));
      payerPaymentNonce = new BN(await api.query.getNonce(payer, 'payment'));
      options = {
        suri: accounts.user.seed,
      }
    });

    xit('Account valid payer address correctly pays for gateway fees', async () => {
        let validOptions = {...options, hasPayer: true, payerAddress: payer};
        const apiWithOptions = await helper.avnApi(validOptions);

        const requestId = await apiWithOptions.send.transferAvt(relayer, recipient, amount);
        await helper.confirmStatus(apiWithOptions, requestId, 'Processed');

        bnEquals(recipientAvtBalanceBefore.add(amount), new BN(await api.query.getAvtBalance(recipient)));
        bnEquals(userAvtBalanceBefore.sub(amount), new BN(await api.query.getAvtBalance(user)));
        assert(relayerAvtBalanceBefore.gte(new BN(await api.query.getAvtBalance(relayer))));
        // bnEquals(payerAvtBalanceBefore.sub(relayerFee), new BN(await api.query.getAvtBalance(payer)))
        assert.equal(payerPaymentNonce.add(new BN(1)), new BN(await api.query.getNonce(payer, 'payment')))
    });

    xit('Account valid payer public key correctly pays for gateway fees', async () => {
        let validOptions = {...options, hasPayer: true, payerAddress: payerPubKey};
        const apiWithOptions = await helper.avnApi(validOptions);

        const requestId = await apiWithOptions.send.transferAvt(relayer, recipient, amount);
        await helper.confirmStatus(apiWithOptions, requestId, 'Processed');

        bnEquals(recipientAvtBalanceBefore.add(amount), new BN(await api.query.getAvtBalance(recipient)));
        bnEquals(userAvtBalanceBefore.sub(amount), new BN(await api.query.getAvtBalance(user)));
        assert(relayerAvtBalanceBefore.gte(new BN(await api.query.getAvtBalance(relayer))));
        // bnEquals(payerAvtBalanceBefore.sub(relayerFee), new BN(await api.query.getAvtBalance(payer)))
        assert.equal(payerPaymentNonce.add(new BN(1)), new BN(await api.query.getNonce(payer, 'payment')))
    });

    xit('Account default added valid payer correctly pays for gateway fees', async () => {
        let validOptions = {...options, hasPayer: true}
        const apiWithOptions = await helper.avnApi(validOptions);

        const requestId = await apiWithOptions.send.transferAvt(relayer, recipient, amount);
        await helper.confirmStatus(apiWithOptions, requestId, 'Processed');

        bnEquals(recipientAvtBalanceBefore.add(amount), await api.query.getAvtBalance(recipient));
        bnEquals(userAvtBalanceBefore.sub(amount), new BN(await api.query.getAvtBalance(user)));
        assert(relayerAvtBalanceBefore.gte(await api.query.getAvtBalance(relayer)));
        // bnEquals(payerAvtBalanceBefore.sub(relayerFee), new BN(await api.query.getAvtBalance(payer)))
        assert.equal(payerPaymentNonce.add(new BN(1)), new BN(await api.query.getNonce(payer, 'payment')))
    });

    xit('hasPayer flag false and valid payerAddress', async () => {
        let invalidOptions = {...options, hasPayer: false, payerAddress: payer};
        const apiWithOptions = await helper.avnApi(invalidOptions);

        const requestId = await apiWithOptions.send.transferAvt(relayer, recipient, amount);
        await helper.confirmStatus(apiWithOptions, requestId, 'Processed');

        bnEquals(recipientAvtBalanceBefore.add(amount), await api.query.getAvtBalance(recipient));
        bnEquals(userAvtBalanceBefore.sub(amount), new BN(await api.query.getAvtBalance(user)));
        assert(relayerAvtBalanceBefore.gte(await api.query.getAvtBalance(relayer)));
        // bnEquals(payerAvtBalanceBefore.sub(relayerFee), new BN(await api.query.getAvtBalance(payer)))
        assert.equal(payerPaymentNonce.add(new BN(1)), new BN(await api.query.getNonce(payer, 'payment')))
    });

    it('Valid payer address but unauthorized transaction', async () => { // PayerRefused message
        let externalRef = 'avn-gateway-test-' + new Date().toISOString();
        let royalties = [];
        const dummyT1Authority = '0xd6ae8250b8348c94847280928c79fb3b63ca453e';

        let invalidOptions = {...options, hasPayer: true, payerAddress: payer};
        const apiWithOptions = await helper.avnApi(invalidOptions);

        const requestId = await api.send.mintSingleNft(relayer, externalRef, royalties, dummyT1Authority);
        console.log("UNAUTHORIZED request id: " + requestId);
        await helper.confirmStatus(apiWithOptions, requestId, 'Processed'); // refused by payer

        bnEquals(userAvtBalanceBefore.sub(relayerFee), new BN(await api.query.getAvtBalance(user)));
        assert(relayerAvtBalanceBefore.gte(await api.query.getAvtBalance(relayer)));
        // bnEquals(payerAvtBalanceBefore, new BN(await api.query.getAvtBalance(payer)));
        // assert.equal(payerPaymentNonce, new BN(await api.query.getNonce(payer, 'payment')));
    });

    xit('incorrect account payer returns an error', async () => {
        let invalidPayer = recipient;
        let invalidOptions = {...options, hasPayer: true, payerAddress: invalidPayer};

        const apiWithOptions = await helper.avnApi(invalidOptions);
        await expect(apiWithOptions.send.transferAvt(relayer, recipient, amount)).to.be.rejectedWith(
          /Request failed with status code 403/
        );
    });
  });
});
