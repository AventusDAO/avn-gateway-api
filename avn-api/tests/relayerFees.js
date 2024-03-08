const chai = require('chai');
const expect = chai.expect;
const assert = chai.assert;
chai.use(require('chai-as-promised'));
const helper = require('./helper.js');
const accounts = helper.ACCOUNTS;
const _ = require('lodash');

describe('Relayer Fees:', async () => {
  let avnApi, api;
  let relayer, user;

  const expectedRelayerFees = {
    proxyStakeAvt: '9000000000000000',
    proxyAvtTransfer: '23800000000000000',
    proxyTokenTransfer: '23800000000000000',
    proxyConfirmTokenLift: '23800000000000000',
    proxyTokenLower: '23800000000000000',
    proxyCreateNftBatch: '23800000000000000',
    proxyMintSingleNft: '23800000000000000',
    proxyMintBatchNft: '23800000000000000',
    proxyListNftOpenForSale: '23800000000000000',
    proxyListNftBatchForSale: '23800000000000000',
    proxyTransferFiatNft: '23800000000000000',
    proxyCancelListFiatNft: '23800000000000000',
    proxyEndNftBatchSale: '23800000000000000',
    proxyIncreaseStake: '23800000000000000',
    proxyUnstake: '23800000000000000',
    proxyWithdrawUnlocked: '23800000000000000',
    proxyScheduleLeaveNominators: '23800000000000000',
    proxyExecuteLeaveNominators: '23800000000000000',
    proxyMintEthereumBatchNft: '23800000000000000',
    proxyTransferEthereumNft: '23800000000000000',
    proxyCancelEthereumNftSale: '23800000000000000',
    proxyEndEthereumBatchSale: '23800000000000000',
    proxyListEthereumNftForSale: '23800000000000000',
    proxyListEthereumNftBatchForSale: '23800000000000000'
  };

  const expectedUserFees = {
    proxyAvtTransfer: '7000000000000000',
    proxyTokenTransfer: '7000000000000000',
    proxyMintSingleNft: '7000000000000000',
    proxyConfirmTokenLift: '23800000000000000',
    proxyTokenLower: '23800000000000000',
    proxyCreateNftBatch: '23800000000000000',
    proxyMintBatchNft: '23800000000000000',
    proxyListNftOpenForSale: '23800000000000000',
    proxyListNftBatchForSale: '23800000000000000',
    proxyTransferFiatNft: '23800000000000000',
    proxyCancelListFiatNft: '23800000000000000',
    proxyEndNftBatchSale: '23800000000000000',
    proxyStakeAvt: '23800000000000000',
    proxyIncreaseStake: '23800000000000000',
    proxyUnstake: '23800000000000000',
    proxyWithdrawUnlocked: '23800000000000000',
    proxyScheduleLeaveNominators: '23800000000000000',
    proxyExecuteLeaveNominators: '23800000000000000',
    proxyMintEthereumBatchNft: '23800000000000000',
    proxyTransferEthereumNft: '23800000000000000',
    proxyCancelEthereumNftSale: '23800000000000000',
    proxyEndEthereumBatchSale: '23800000000000000',
    proxyListEthereumNftForSale: '23800000000000000',
    proxyListEthereumNftBatchForSale: '23800000000000000'
  };

  before(async () => {
    avnApi = await helper.avnApi({
      suri: accounts.user.seed
    });
    api = await avnApi.apis();
    relayer = accounts.relayer;
    user = accounts.user;
    recipient = accounts.otherUser;
    token = helper.token;
  });

  describe('getRelayerFees', async () => {
    it('returns default fees for a relayer by address', async () => {
      const returnedFees = await api.query.getRelayerFees(relayer.address);
      assert(_.isEqual(returnedFees, expectedRelayerFees));
    });

    it('returns default fees for a relayer by publicKey', async () => {
      const returnedFees = await api.query.getRelayerFees(relayer.publicKey);
      assert(_.isEqual(returnedFees, expectedRelayerFees));
    });

    it('returns fees for a specific user by address', async () => {
      const returnedFees = await api.query.getRelayerFees(relayer.address, user.address);
      assert(_.isEqual(returnedFees, expectedUserFees));
    });

    it('returns fees for a specific user by publicKey', async () => {
      const returnedFees = await api.query.getRelayerFees(relayer.publicKey, user.publicKey);
      assert(_.isEqual(returnedFees, expectedUserFees));
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
        /Invalid empty address passed/
      );
    });

    it('errors if relayer is not registered', async () => {
      await expect(api.query.getRelayerFees(user)).to.be.rejectedWith(Error);
    });
  });
});
