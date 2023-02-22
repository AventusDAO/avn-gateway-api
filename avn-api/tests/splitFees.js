const chai = require('chai');
const expect = chai.expect;
const assert = chai.assert;
const helper = require('./helper.js');
const accounts = helper.ACCOUNTS;
const BN = helper.BN;

const amount = new BN(1);
const relayer = accounts.relayer.address;
const user = accounts.user.address;
const recipient = accounts.otherUser.address;
const payer = accounts.payer.address;
const payerPubKey = accounts.payer.publicKey;

describe('Split fees calls:', async () => {
  let api;
  let relayerFee;

  before(async () => {
    api = await helper.avnApi();
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
        relayer: relayer
      }
    });

    let verifySplitFeesBalancesAndNonce = async () => {
      return recipientAvtBalanceBefore.add(amount).eq(new BN(await api.query.getAvtBalance(recipient))) &&
             userAvtBalanceBefore.sub(amount).eq(new BN(await api.query.getAvtBalance(user))) &&
             relayerAvtBalanceBefore.gt(new BN(await api.query.getAvtBalance(relayer))) &&
             payerPaymentNonce.add(new BN(1)).eq(new BN(await api.query.getNonce(payer, 'payment'))) &&
             payerAvtBalanceBefore.sub(relayerFee).eq(new BN(await api.query.getAvtBalance(payer)))
    }

    it('With valid payer address', async () => {
        let validOptions = {...options, hasPayer: true, payerAddress: payer};
        const apiWithOptions = await helper.avnApi(validOptions);

        const requestId = await apiWithOptions.send.transferAvt(recipient, amount);
        await helper.confirmStatus(apiWithOptions, requestId, 'Processed');

        assert(await verifySplitFeesBalancesAndNonce());
    });

    it('With valid payer public key', async () => {
        let validOptions = {...options, hasPayer: true, payerAddress: payerPubKey};
        const apiWithOptions = await helper.avnApi(validOptions);

        const requestId = await apiWithOptions.send.transferAvt(recipient, amount);
        await helper.confirmStatus(apiWithOptions, requestId, 'Processed');

        assert(await verifySplitFeesBalancesAndNonce());
    });

    it('With default payer account, hasPayer flag true', async () => {
        let validOptions = {...options, hasPayer: true}
        const apiWithOptions = await helper.avnApi(validOptions);

        const requestId = await apiWithOptions.send.transferAvt(recipient, amount);
        await helper.confirmStatus(apiWithOptions, requestId, 'Processed');

        assert(await verifySplitFeesBalancesAndNonce());
    });

    it('With hasPayer flag set to false, valid payer address should override', async () => {
        let invalidOptions = {...options, hasPayer: false, payerAddress: payer};
        const apiWithOptions = await helper.avnApi(invalidOptions);

        const requestId = await apiWithOptions.send.transferAvt(recipient, amount);
        await helper.confirmStatus(apiWithOptions, requestId, 'Processed');

        assert(await verifySplitFeesBalancesAndNonce());
    });

    it('With valid payer address but unauthorized transaction, payer should refuse', async () => {
        let externalRef = 'avn-gateway-test-' + new Date().toISOString();
        let royalties = [];
        const dummyT1Authority = '0xd6ae8250b8348c94847280928c79fb3b63ca453e';

        let invalidOptions = {...options, hasPayer: true, payerAddress: payer};
        const apiWithOptions = await helper.avnApi(invalidOptions);

        const requestId = await apiWithOptions.send.mintSingleNft(externalRef, royalties, dummyT1Authority);
        await helper.confirmStatus(apiWithOptions, requestId, 'PayerRefused');
    });

    it('With invalid payer, an error is thrown', async () => {
        let invalidPayer = recipient;
        let invalidOptions = {...options, hasPayer: true, payerAddress: invalidPayer};

        const apiWithOptions = await helper.avnApi(invalidOptions);
        await expect(apiWithOptions.send.transferAvt(recipient, amount)).to.be.rejectedWith(
          /Request failed with status code 403/
        );
    });
  });
});
