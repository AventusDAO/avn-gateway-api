const chai = require('chai');
const expect = chai.expect;
const assert = chai.assert;
chai.use(require('chai-as-promised'));
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
  let avnApi, api;
  let relayerFee;

  before(async () => {
    avnApi = await helper.avnApi({
      suri: accounts.user.seed
    });
    api = await avnApi.apis();
    relayerFee = new BN((await api.query.getRelayerFees(relayer, payer)).proxyAvtTransfer);
  });

  describe('Split fees', async () => {
    let userAvtBalanceBefore,
      recipientAvtBalanceBefore,
      relayerAvtBalanceBefore,
      payerAvtBalanceBefore,
      options,
      payerPaymentNonce;

    beforeEach(async () => {
      userAvtBalanceBefore = new BN(await api.query.getAvtBalance(user));
      recipientAvtBalanceBefore = new BN(await api.query.getAvtBalance(recipient));
      relayerAvtBalanceBefore = new BN(await api.query.getAvtBalance(relayer));
      payerAvtBalanceBefore = new BN(await api.query.getAvtBalance(payer));
      payerPaymentNonce = new BN(await api.query.getNonce(payer, 'payment'));
      options = {
        suri: accounts.user.seed,
        relayer: relayer
      };
    });

    let verifySplitFeesBalancesAndNonce = async () => {
      assert(recipientAvtBalanceBefore.add(amount).eq(new BN(await api.query.getAvtBalance(recipient))));
      assert(userAvtBalanceBefore.sub(amount).eq(new BN(await api.query.getAvtBalance(user))));
      assert(payerAvtBalanceBefore.sub(relayerFee).eq(new BN(await api.query.getAvtBalance(payer))));
      assert(new BN(await api.query.getAvtBalance(relayer)).gt(relayerAvtBalanceBefore));
      assert(payerPaymentNonce.add(new BN(1)).eq(new BN(await api.query.getNonce(payer, 'payment'))));
    };

    it('With valid payer address', async () => {
      let validOptions = { ...options, hasPayer: true, payerAddress: payer };
      const apiWithOptions = await helper.avnApi(validOptions);
      const newApi = await apiWithOptions.apis();
      const requestId = await newApi.send.transferAvt(recipient, amount);
      await helper.confirmStatus(newApi.poll, requestId, 'Processed');

      await verifySplitFeesBalancesAndNonce();
    });

    it('With valid payer public key', async () => {
      let validOptions = { ...options, hasPayer: true, payerAddress: payerPubKey };
      const apiWithOptions = await helper.avnApi(validOptions);
      const newApi = await apiWithOptions.apis();

      const requestId = await newApi.send.transferAvt(recipient, amount);
      await helper.confirmStatus(newApi.poll, requestId, 'Processed');

      await verifySplitFeesBalancesAndNonce();
    });

    it('With default payer account, hasPayer flag true', async () => {
      let validOptions = { ...options, hasPayer: true };
      const apiWithOptions = await helper.avnApi(validOptions);
      const newApi = await apiWithOptions.apis();

      const requestId = await newApi.send.transferAvt(recipient, amount);
      await helper.confirmStatus(newApi.poll, requestId, 'Processed');

      await verifySplitFeesBalancesAndNonce();
    });

    it('With hasPayer flag set to false, valid payer address should override', async () => {
      let invalidOptions = { ...options, hasPayer: false, payerAddress: payer };
      const apiWithOptions = await helper.avnApi(invalidOptions);
      const newApi = await apiWithOptions.apis();

      const requestId = await newApi.send.transferAvt(recipient, amount);
      await helper.confirmStatus(newApi.poll, requestId, 'Processed');

      await verifySplitFeesBalancesAndNonce();
    });

    // this test requires a very specific setup, I propose we remove it
    xit('With valid payer address but unauthorized transaction, payer should refuse', async () => {
      let externalRef = 'avn-gateway-test-' + new Date().toISOString();
      let royalties = [];
      const dummyT1Authority = '0xd6ae8250b8348c94847280928c79fb3b63ca453e';

      let invalidOptions = { ...options, hasPayer: true, payerAddress: payer };
      const apiWithOptions = await helper.avnApi(invalidOptions);
      const newApi = await apiWithOptions.apis();

      const requestId = await newApi.send.mintSingleNft(externalRef, royalties, dummyT1Authority);
      await helper.confirmStatus(newApi.poll, requestId, 'PayerRefused');
    });

    it('With invalid payer, an error is thrown', async () => {
      let invalidPayer = '5HnPuKiHbyYBMV76vvA46fk6HZHDt7LU9R7YcyiWnBVzUhdu';
      let invalidOptions = { ...options, hasPayer: true, payerAddress: invalidPayer };

      const apiWithOptions = await helper.avnApi(invalidOptions);
      const newApi = await apiWithOptions.apis();

      await expect(newApi.send.transferAvt(recipient, amount)).to.be.rejectedWith(
        /Request failed with status code 403/
      );
    });
  });
});
