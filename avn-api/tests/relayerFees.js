const chai = require('chai');
const expect = chai.expect;
const assert = chai.assert;
chai.use(require('chai-as-promised'));
const helper = require('./helper.js');
const accounts = helper.ACCOUNTS;

describe('Relayer Fees:', async () => {
  let api;
  let relayer, user;

  const expectedRelayerFees = {
    proxyStakeAvt: '9000000000000000',
    proxyAvtTransfer: '1000000000000000',
    proxyTokenTransfer: '1000000000000000',
    proxyConfirmTokenLift: '1000000000000000',
    proxyTokenLower: '1000000000000000',
    proxyMintSingleNft: '1000000000000000',
    proxyListNftOpenForSale: '1000000000000000',
    proxyTransferFiatNft: '1000000000000000',
    proxyCancelListFiatNft: '1000000000000000',
    proxyIncreaseStake: '1000000000000000',
    proxyUnstake: '1000000000000000',
    proxyWithdrawUnlocked: '1000000000000000'
  };

  const expectedUserFees = {
    proxyAvtTransfer: '7000000000000000',
    proxyTokenTransfer: '7000000000000000',
    proxyMintSingleNft: '7000000000000000',
    proxyConfirmTokenLift: '1000000000000000',
    proxyTokenLower: '1000000000000000',
    proxyListNftOpenForSale: '1000000000000000',
    proxyTransferFiatNft: '1000000000000000',
    proxyCancelListFiatNft: '1000000000000000',
    proxyStakeAvt: '1000000000000000',
    proxyIncreaseStake: '1000000000000000',
    proxyUnstake: '1000000000000000',
    proxyWithdrawUnlocked: '1000000000000000'
  };

  before(async () => {
    api = await helper.avnApi();
    relayer = accounts.relayer;
    user = accounts.user;
    recipient = accounts.otherUser;
    token = helper.token;
  });

  describe('getRelayerFees', async () => {
    it('returns default fees for a relayer by address', async () => {
      const returnedFees = await api.query.getRelayerFees(relayer.address);
      assert.equal(JSON.stringify(returnedFees), JSON.stringify(expectedRelayerFees));
    });

    it('returns default fees for a relayer by publicKey', async () => {
      const returnedFees = await api.query.getRelayerFees(relayer.publicKey);
      assert.equal(JSON.stringify(returnedFees), JSON.stringify(expectedRelayerFees));
    });

    it('returns fees for a specific user by address', async () => {
      const returnedFees = await api.query.getRelayerFees(relayer.address, user.address);
      assert.equal(JSON.stringify(returnedFees), JSON.stringify(expectedUserFees));
    });

    it('returns fees for a specific user by publicKey', async () => {
      const returnedFees = await api.query.getRelayerFees(relayer.publicKey, user.publicKey);
      assert.equal(JSON.stringify(returnedFees), JSON.stringify(expectedUserFees));
    });

    it('returns the fee for a specific user and transaction type', async () => {
      const transactionType = 'proxyTokenTransfer';
      const returnedFees = await api.query.getRelayerFees(relayer.address, user.publicKey, transactionType);
      assert.equal(returnedFees, expectedUserFees[transactionType]);
    });

    it('returns fees for a specific transaction type that has a default value for all users', async () => {
      const transactionType = 'proxyStakeAvt';
      const returnedFees = await api.query.getRelayerFees(relayer.address, null, transactionType);
      assert.equal(returnedFees, expectedRelayerFees[transactionType]);
    });

    it('Errors if relayer is not specified for a specific transaction type and user', async () => {
      const transactionType = 'proxyStakeAvt';
      await expect(api.query.getRelayerFees(null, user.publicKey, transactionType)).to.be.rejectedWith(
         /Expected non-null/
      );
    });

    it('errors if relayer is not registered', async () => {
      await expect(api.query.getRelayerFees(user)).to.be.rejectedWith(Error);
    });
  });
});
