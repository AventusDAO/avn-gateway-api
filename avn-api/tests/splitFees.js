const chai = require('chai');
const { SetupMode, SigningMode } = require('avn-api');
const expect = chai.expect;
const assert = chai.assert;
chai.use(require('chai-as-promised'));
const helper = require('./helper.js');
const accounts = helper.ACCOUNTS;
const BN = helper.BN;
const {
  registerSplitFeeUser
} = require('./splitFeeHelper');

const amount = new BN(1);
const relayer = accounts.relayer.address;
const user = accounts.user.address;
const recipient = accounts.otherUser.address;
const payer = accounts.payer.address;
const payerPubKey = accounts.payer.publicKey;
const MINIMUM_REQUIRED_TEST_BALANCE = helper.convertToBaseUnits(1);

describe('Split fees calls:', async () => {
  let api, avt;
  let relayerFee;

  before(async () => {
    const signer = {
      sign: async (data, signerAddress) => {
        return await helper.remoteSigner(data, signerAddress);
      }
    };

    const options = {
      signer: signer,
      setupMode: SetupMode.MultiUser,
      signingMode: SigningMode.RemoteSigner
    };

    avnGateway = await helper.avnApi(options);
    api = await avnGateway.apis(user);
    bankApi = await avnGateway.apis(accounts.bank.address);
    avt = await api.query.getAvtContractAddress();
    
    relayerFee = new BN((await api.query.getRelayerFees(relayer, avt, payer)).proxyAvtTransfer);
    await registerSplitFeeUser(accounts.user.publicKey);
  });

  describe('Test setup', function () {
    let senderBalance, payerBalance;
    before(async () => {
      senderBalance = new BN(await api.query.getAvtBalance(user));
      payerBalance = new BN(await api.query.getAvtBalance(payer));
    });

    describe('succeeds if', async function () {
      it('sender is funded', async function () {
        if (senderBalance.lt(MINIMUM_REQUIRED_TEST_BALANCE)) {
          let amountLeft = MINIMUM_REQUIRED_TEST_BALANCE.sub(senderBalance);

          const requestId = await bankApi.send.transferAvt(user, amountLeft);
          await helper.confirmStatus(bankApi.poll, requestId, 'Processed');

          senderBalance = new BN(await api.query.getAvtBalance(user));
        }
        assert(senderBalance.gte(MINIMUM_REQUIRED_TEST_BALANCE));
      });

      it('payer is funded', async function () {
        if (payerBalance.lt(MINIMUM_REQUIRED_TEST_BALANCE)) {
          let amountLeft = MINIMUM_REQUIRED_TEST_BALANCE.sub(payerBalance);

          const requestId = await bankApi.send.transferAvt(payer, amountLeft);
          await helper.confirmStatus(bankApi.poll, requestId, 'Processed');

          payerBalance = new BN(await api.query.getAvtBalance(payer));
        }
        assert(payerBalance.gte(MINIMUM_REQUIRED_TEST_BALANCE));
      });
    });
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
      payerPaymentNonce = new BN(await api.query.getUserNonce(payer, 'payment'));
      options = {
        suri: accounts.user.seed,
        relayer: relayer
      };
    });

    let verifySplitFeesBalancesAndNonce = async () => {
      assert(recipientAvtBalanceBefore.add(amount).eq(new BN(await api.query.getAvtBalance(recipient))));
      assert(userAvtBalanceBefore.sub(amount).eq(new BN(await api.query.getAvtBalance(user))));
      assert(payerAvtBalanceBefore.sub(relayerFee).eq(new BN(await api.query.getAvtBalance(payer))));
      assert(payerPaymentNonce.add(new BN(1)).eq(new BN(await api.query.getUserNonce(payer, 'payment'))));
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

    it('With invalid payer, an error is thrown', async () => {
      let invalidPayer = '5HnPuKiHbyYBMV76vvA46fk6HZHDt7LU9R7YcyiWnBVzUhdu';
      let invalidOptions = { ...options, hasPayer: true, payerAddress: invalidPayer };

      const apiWithOptions = await helper.avnApi(invalidOptions);
      const newApi = await apiWithOptions.apis();

      await expect(newApi.send.transferAvt(recipient, amount)).to.be.rejectedWith(/Request failed with status code 403/);
    });
  });
});
