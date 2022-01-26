const chai = require('chai');
const expect = chai.expect;
const testPatterns = require('./testPatterns.js');
chai.use(require('chai-as-promised'));
const helper = require('./helper.js');
const accounts = helper.ACCOUNTS;

(async function () {
  const api = await helper.avnApi();
  const validRelayer = accounts.relayer;
  const validSender = accounts.sender;
  const validUser = accounts.user1;
  const validToken = helper.token;

  describe('Fail Query api calls:', async done => {
    describe('getAvtBalance', async () => {
      describe('fails when called', async () => {
        describe('With invalid account', async () => {
          let validCallData = {
            account: validSender.address
          };
          await testPatterns.invalidAccount('Account', 'account', validCallData, api.query.getAvtBalance);
        });
      });
    });

    describe('getTokenBalance', async () => {
      describe('fails when called', async () => {
        let validCallData = {
          account: validSender.address,
          token: validToken
        };
        describe('With invalid account', async () => {
          await testPatterns.invalidAccount('Account', 'account', validCallData, api.query.getTokenBalance);
        });
        describe('With invalid token', async () => {
          await testPatterns.invalidEthereumToken('Token', 'token', validCallData, api.query.getTokenBalance);
        });
      });
    });

    describe('getAccountNonce', async () => {
      describe('fails when called', async () => {
        let validCallData = {
          account: validSender.address
        };
        describe('With invalid account', async () => {
          await testPatterns.invalidAccount('Account', 'account', validCallData, api.query.getAccountNonce);
        });
      });
    });

    describe('getAccountPaymentNonce', async () => {
      describe('fails when called', async () => {
        let validCallData = {
          account: validSender.address
        };
        describe('With invalid account', async () => {
          await testPatterns.invalidAccount('Account', 'account', validCallData, api.query.getAccountPaymentNonce);
        });
      });
    });

    describe('getRelayerFees', async () => {
      let validCallData = {
        relayer: validRelayer.address,
        user: validUser.address,
        transaction_type: 'proxyAvtTransfer'
      };
      beforeEach(async () => {
        validCallData = {
          relayer: validRelayer.address,
          user: validUser.address,
          transaction_type: 'proxyAvtTransfer'
        };
      });
      describe('fails when called', async () => {
        describe('With invalid account: Relayer', async () => {
          let validData = {
            relayer: validRelayer.address
          };
          await testPatterns.invalidAccount('Relayer', 'relayer', validData, api.query.getRelayerFees);
        });
        //TODO: investigate unexpected error when passing 2 arguments and we are validating the second argument
        xdescribe('With invalid account: User', async () => {
          let validData = {
            relayer: validRelayer.address,
            user: validUser.address
          };
          await testPatterns.invalidAccount('User', 'user', validData, api.query.getRelayerFees);
        });
        //TODO: Fix 500 error when calling the function with a relayer that is not a relayer
        xit('With relayer address that is not a relayer', async () => {
          validCallData['relayer'] = validSender.address;
          console.log(await api.query.getRelayerFees(...Object.values(validCallData)));
        });
        it('With invalid transaction type', async () => {
          validCallData['transaction_type'] = 'invalid_type';
          await expect(api.query.getRelayerFees(...Object.values(validCallData))).to.be.rejectedWith(
            /Invalid transaction type:/
          );
        });
      });
    });

    describe('getNftNonce', async () => {
      describe('fails when called', async () => {
        let validCallData = {
          nftId: 'valid_id'
        };
        describe('With invalid nft id', async () => {
          await testPatterns.invalidNftId('Nft Id', 'nftId', validCallData, api.query.getNftNonce);
        });
      });
    });

    describe('getNftId', async () => {
      describe('fails when called', async () => {
        let validCallData = {
          externalReference: 'valid_reference'
        };
        describe('With invalid external reference', async () => {
          await testPatterns.invalidExternalReference(
            'External reference',
            'externalReference',
            validCallData,
            api.query.getNftId
          );
        });
      });
    });

    describe('getNftOwner', async () => {
      describe('fails when called', async () => {
        let validCallData = {
          nftId: 'valid_id'
        };
        describe('With invalid nft id', async () => {
          await testPatterns.invalidNftId('Nft id', 'nftId', validCallData, api.query.getNftOwner);
        });
      });
    });
  });
  run();
})();
