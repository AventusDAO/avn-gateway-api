const chai = require('chai');
const expect = chai.expect;
const assert = chai.assert;

describe('Fail Query api calls:', async () => {
  before(async () => {
    //set up params
  });

  beforeEach(async () => {
    //reset state for isolation of tests
  });

  describe('getAvtBalance', async () => {
    //getAvtBalance(account)
    describe('fails when called', async () => {
      it('With account as empty string');
      it('With account as undefined');
      it('With account in invalid format');
      it('With account address short');
      it('With account address long');
    });
  });

  describe('getTokenBalance', async () => {
    //getTokenBalance(account, token_address)
    describe('fails when called', async () => {
      it('With account as empty string');
      it('With account as undefined');
      it('With account in invalid format');
      it('With account address short');
      it('With account address long');
      it('With token as empty string');
      it('With token as undefined');
      it('With token in invalid format');
      it('With token address short');
      it('With token address long');
    });
  });

  describe('getAccountNonce', async () => {
    //getAccountNonce(account)
    describe('fails when called', async () => {
      it('With account as empty string');
      it('With account as undefined');
      it('With account in invalid format');
      it('With account address short');
      it('With account address long');
      it('With account in valid format but not existent');
    });
  });

  describe('getAccountPaymentNonce', async () => {
    //getAccountPaymentNonce(account)
    describe('fails when called', async () => {
      it('With account as empty string');
      it('With account as undefined');
      it('With account in invalid format');
      it('With account address short');
      it('With account address long');
      it('With account in valid format but not existent');
    });
  });

  describe('getRelayerFees', async () => {
    //getRelayerFees(avnRelayerAddress);
    //getRelayerFees(avnRelayerAddress, user);
    //getRelayerFees(avnRelayerAddress, user, _transaction_type);
    describe('fails when called', async () => {
      it('With relayer as empty string');
      it('With relayer as undefined');
      it('With relayer address in invalid format');
      it('With relayer address short');
      it('With relayer address long');
      it('With user as empty string');
      it('With user as undefined');
      it('With user in invalid format');
      it('With user address short');
      it('With user address long');
      it('With transaction as empty string');
      it('With transaction type as undefined');
      it('With transaction type wrong');
    });
  });

  describe('getNftNonce', async () => {
    //getNftNonce(nftId)
    describe('fails when called', async () => {
      it('With nft id as empty string');
      it('With nft id as undefined');
      it('With nft id that doesnt exist');
    });
  });

  describe('getNftId', async () => {
    //getNftId(external_reference);
    describe('fails when called', async () => {
      it('With external reference as empty string');
      it('With external reference as undefined');
      it('With external reference in invalid format');
      it('With external reference in valid format but not existent');
    });
  });

  describe('getNftOwner', async () => {
    //getNftOwner(nftId)
    describe('fails when called', async () => {
      it('With nft id as empty string');
      it('With nft id as undefined');
      it('With nft id that doesnt exist');
    });
  });
});
