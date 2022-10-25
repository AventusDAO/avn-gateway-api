const chai = require('chai');
const expect = chai.expect;
const testPatterns = require('./testPatterns.js');
chai.use(require('chai-as-promised'));
const helper = require('./helper.js');
const accounts = helper.ACCOUNTS;
const nfts = helper.NFTS;

// Immediately Invoked Function Expression to make async calls available before the test suite
// This makes run() method available to be called with --delay flag
(async function () {
  if (!nfts) {
    console.log('*** Please run: npm run generateState --gateway <environment> ***');
    return;
  }

  const api = await helper.avnApi();
  const validRelayer = accounts.relayer;
  const validUser = accounts.user;
  const otherUser = accounts.otherUser;
  const validToken = helper.token;
  const unlistedUserNft = nfts.user.unlistedNft;
  const validNonceType = 'token';
  let testConfig;

  describe('Fail Query api calls:', async done => {
    describe('getAvtBalance', async () => {
      describe('fails when called', async () => {
        testConfig = {
          validCallData: {
            account: validUser.address
          },
          selectionField: undefined,
          testFunction: api.query.getAvtBalance
        };
        describe('With invalid account', async () => {
          testConfig.selectionField = 'account';
          await testPatterns.invalidAccount(testConfig);
        });
      });
    });

    describe('getTokenBalance', async () => {
      describe('fails when called', async () => {
        testConfig = {
          validCallData: {
            account: validUser.address,
            token: validToken
          },
          selectionField: undefined,
          testFunction: api.query.getTokenBalance
        };
        describe('With invalid account', async () => {
          testConfig.selectionField = 'account';
          await testPatterns.invalidAccount(testConfig);
        });
        describe('With invalid token', async () => {
          testConfig.selectionField = 'token';
          await testPatterns.invalidEthereumAddress(testConfig);
        });
      });
    });

    describe('getAccountNonce', async () => {
      describe('fails when called', async () => {
        testConfig = {
          validCallData: {
            account: validUser.address,
            nonceType: validNonceType
          },
          selectionField: undefined,
          testFunction: api.query.getNonce
        };
        describe('With invalid account', async () => {
          testConfig.selectionField = 'account';
          await testPatterns.invalidAccount(testConfig);
        });
        describe('With invalid nonce type', async () => {
          testConfig.selectionField = 'nonceType';
          await testPatterns.invalidNonceType(testConfig);
        });
      });
    });

    describe('getRelayerFees', async () => {
      testConfig = {
        validCallData: {
          relayer: validRelayer.address,
          user: validOtherUser.address,
          transaction_type: 'proxyAvtTransfer'
        },
        selectionField: undefined,
        testFunction: api.query.getRelayerFees
      };
      beforeEach(async () => {
        testConfig.validCallData = {
          relayer: validRelayer.address,
          user: validOtherUser.address,
          transaction_type: 'proxyAvtTransfer'
        };
      });
      describe('fails when called', async () => {
        describe('With invalid account: Relayer', async () => {
          testConfig.validCallData = {
            relayer: validRelayer.address
          };
          testConfig.selectionField = 'relayer';
          await testPatterns.invalidAccount(testConfig);
        });
        //TODO: investigate unexpected error when passing 2 arguments and we are validating the second argument
        //TypeError: Cannot read property 'postRequest' of undefined should be 'Expected non-null, non-empty base58 input'
        //This occurs on undefined and empty string tests only
        describe('With invalid account: User', async () => {
          testConfig.validCallData = {
            relayer: validRelayer.address,
            user: validUser.address
          };
          testConfig.selectionField = 'user';
          await testPatterns.invalidAccount(testConfig);
        });
        it('With relayer address that is not a relayer', async () => {
          testConfig.validCallData.relayer = validUser.address;
          await expect(api.query.getRelayerFees(...Object.values(testConfig.validCallData))).to.be.rejectedWith(
            /Relayer.*is not registered with AvN Gateway/
          );
        });
        it('With invalid transaction type', async () => {
          testConfig.validCallData.transaction_type = 'invalid_type';
          await expect(api.query.getRelayerFees(...Object.values(testConfig.validCallData))).to.be.rejectedWith(
            /Invalid transaction type:/
          );
        });
      });
    });

    describe('getNftNonce', async () => {
      describe('fails when called', async () => {
        testConfig = {
          validCallData: {
            nftId: unlistedUserNft
          },
          selectionField: undefined,
          testFunction: api.query.getNftNonce
        };
        describe('With invalid nft id', async () => {
          testConfig.selectionField = 'nftId';
          await testPatterns.invalidNftId(testConfig);
        });
      });
    });

    describe('getNftId', async () => {
      describe('fails when called', async () => {
        testConfig = {
          validCallData: {
            externalReference: 'valid_reference'
          },
          selectionField: undefined,
          testFunction: api.query.getNftId
        };
        describe('With invalid external reference', async () => {
          testConfig.selectionField = 'externalReference';
          await testPatterns.invalidExternalReference(testConfig);
        });
      });
    });

    describe('getNftOwner', async () => {
      describe('fails when called', async () => {
        let validCallData = {
          nftId: 'valid_id'
        };
        testConfig = {
          validCallData: {
            nftId: unlistedUserNft
          },
          selectionField: undefined,
          testFunction: api.query.getNftOwner
        };
        describe('With invalid nft id', async () => {
          testConfig.selectionField = 'nftId';
          await testPatterns.invalidNftId(testConfig);
        });
      });
    });
  });
  run();
})();
