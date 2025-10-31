const chai = require('chai');
const expect = chai.expect;
const testPatterns = require('./testPatterns.js');
chai.use(require('chai-as-promised'));
const helper = require('./helper.js');
const accounts = helper.ACCOUNTS;
const nfts = helper.NFTS;
const BN = helper.BN;

// Immediately Invoked Function Expression to make async calls available before the test suite
// This makes run() method available to be called with --delay flag
(async function () {
  if (!nfts) {
    console.log('*** Please run: npm run generateState --gateway <environment> ***');
    return;
  }

  const avnApi = await helper.avnApi({
    suri: accounts.user.seed
  });
  const api = await avnApi.apis();
  const validOtherUser = accounts.otherUser;
  const validToken = helper.token;

  const royaltyRecipient1 = '0xf8f77379A1C6b5CA66702b5943c5b229E310Ec03';
  const royaltyRate1 = 10000;
  const dummyT1Authority = '0xd6ae8250b8348c94847280928c79fb3b63ca453e';
  const externalRef = 'avn-gateway-test-' + new Date().toISOString();
  const royalties = [
    {
      recipient_t1_address: royaltyRecipient1,
      rate: {
        parts_per_million: royaltyRate1
      }
    }
  ];

  //Nfts owned by User
  const unlistedUserNft = nfts.user.unlistedNft;
  const listedUserNft = nfts.user.listedNft;

  let testConfig;

  describe('Fail Send api calls:', async () => {
    describe('transferAvt', async () => {
      describe('fails when called', async () => {
        testConfig = {
          validCallData: {
            recipient: validOtherUser.address,
            amount: 22
          },
          selectionField: undefined,
          testFunction: api.send.transferAvt
        };
        beforeEach(async () => {
          testConfig.validCallData = {
            recipient: validOtherUser.address,
            amount: 22
          };
        });
        describe('With invalid account: recipient', async () => {
          testConfig.selectionField = 'recipient';
          await testPatterns.invalidAccount(testConfig);
        });
        describe('With invalid amount', async () => {
          testConfig.selectionField = 'amount';
          await testPatterns.invalidAmount(testConfig);
        });
        it('With amount greater than users balance', async () => {
          const userAvtBalance = await api.query.getAvtBalance(accounts.user.address);
          const greaterAmount = new BN(userAvtBalance).add(new BN('1'));
          testConfig.validCallData.amount = greaterAmount;
          const requestId = await api.send.transferAvt(...Object.values(testConfig.validCallData));
          await helper.confirmStatus(api.poll, requestId, 'Rejected');
        });
      });
    });

    describe('transferToken', async () => {
      describe('fails when called', async () => {
        testConfig = {
          validCallData: {
            recipient: validOtherUser.address,
            token: validToken,
            amount: 22
          },
          selectionField: undefined,
          testFunction: api.send.transferToken
        };
        beforeEach(async () => {
          testConfig.validCallData = {
            recipient: validOtherUser.address,
            token: validToken,
            amount: 22
          };
        });
        describe('With invalid account: recipient', async () => {
          testConfig.selectionField = 'recipient';
          await testPatterns.invalidAccount(testConfig);
        });
        describe('With invalid token', async () => {
          testConfig.selectionField = 'token';
          await testPatterns.invalidEthereumAddress(testConfig);
        });
        describe('With invalid token amount', async () => {
          testConfig.selectionField = 'amount';
          await testPatterns.invalidAmount(testConfig);
        });
        it('With token amount greater than users balance', async () => {
          const userAvtBalance = await api.query.getTokenBalance(accounts.user.address, testConfig.validCallData.token);
          const greaterAmount = new BN(userAvtBalance).add(new BN('1'));
          testConfig.validCallData.amount = greaterAmount;
          const requestId = await api.send.transferToken(...Object.values(testConfig.validCallData));
          await helper.confirmStatus(api.poll, requestId, 'Rejected');
        });
      });
    });

    describe('mintSingleNft', async () => {
      describe('fails when called', async () => {
        testConfig = {
          validCallData: {
            externalReference: externalRef,
            royalties: royalties,
            ethereumAddress: dummyT1Authority
          },
          selectionField: undefined,
          testFunction: api.send.mintSingleNft
        };
        beforeEach(async () => {
          testConfig.validCallData = {
            externalReference: externalRef,
            royalties: [
              {
                recipient_t1_address: royaltyRecipient1,
                rate: {
                  parts_per_million: royaltyRate1
                }
              }
            ],
            ethereumAddress: dummyT1Authority
          };
        });
        describe('With invalid account: T1Authority', async () => {
          testConfig.selectionField = 'ethereumAddress';
          await testPatterns.invalidEthereumAddress(testConfig);
        });
        describe('With invalid external reference', async () => {
          testConfig.selectionField = 'externalReference';
          await testPatterns.invalidExternalReference(testConfig);
        });

        it('With royalties as undefined', async () => {
          testConfig.validCallData.royalties = undefined;
          await expect(api.send.mintSingleNft(...Object.values(testConfig.validCallData))).to.be.rejectedWith(
            /Invalid array type:/
          );
        });
        it('With royalties with invalid JSON format', async () => {
          testConfig.validCallData.royalties = [
            {
              recipient_t1_address: royaltyRecipient1,
              parts_per_million: royaltyRate1
            }
          ];
          await expect(api.send.mintSingleNft(...Object.values(testConfig.validCallData))).to.be.rejectedWith(
            /royalties is not defined/
          );
        });
        it('With royalties where recipient address is empty string', async () => {
          testConfig.validCallData.royalties[0].recipient_t1_address = '';
          await expect(api.send.mintSingleNft(...Object.values(testConfig.validCallData))).to.be.rejectedWith(
            /Invalid ethereum address type:/
          );
        });
        it('With royalties where recipient address is undefined', async () => {
          testConfig.validCallData.royalties[0].recipient_t1_address = undefined;
          await expect(api.send.mintSingleNft(...Object.values(testConfig.validCallData))).to.be.rejectedWith(
            /Invalid ethereum address type:/
          );
        });
        it('With royalties where recipient address is in invalid format', async () => {
          testConfig.validCallData.royalties[0].recipient_t1_address = 'invalid_format';
          await expect(api.send.mintSingleNft(...Object.values(testConfig.validCallData))).to.be.rejectedWith(
            /Invalid ethereum address type:/
          );
        });
        it('With royalties where recipient address is short', async () => {
          testConfig.validCallData.royalties[0].recipient_t1_address = '0xf8f77379A1C6b5CA66702b5943c5b229E310Ec';
          await expect(api.send.mintSingleNft(...Object.values(testConfig.validCallData))).to.be.rejectedWith(
            /Invalid ethereum address type:/
          );
        });
        it('With royalties where recipient address is long', async () => {
          testConfig.validCallData.royalties[0].recipient_t1_address = '0xf8f77379A1C6b5CA66702b5943c5b229E310Ec03ab';
          await expect(api.send.mintSingleNft(...Object.values(testConfig.validCallData))).to.be.rejectedWith(
            /Invalid ethereum address type:/
          );
        });
        it('With royalties where parts_per_million not a number', async () => {
          testConfig.validCallData.royalties[0].rate.parts_per_million = 'string';
          await expect(api.send.mintSingleNft(...Object.values(testConfig.validCallData))).to.be.rejectedWith(
            /Invalid rate value:/
          );
        });
        it('With royalties where parts_per_million is zero', async () => {
          testConfig.validCallData.royalties[0].rate.parts_per_million = 0;
          await expect(api.send.mintSingleNft(...Object.values(testConfig.validCallData))).to.be.rejectedWith(
            /Invalid rate value:/
          );
        });
        it('With royalties where parts_per_million is not integer', async () => {
          testConfig.validCallData.royalties[0].rate.parts_per_million = 10.1;
          await expect(api.send.mintSingleNft(...Object.values(testConfig.validCallData))).to.be.rejectedWith(
            /Invalid rate value:/
          );
        });
        it('With royalties where parts_per_million is bigger than 1,000,000', async () => {
          testConfig.validCallData.royalties[0].rate.parts_per_million = 1000001;
          await expect(api.send.mintSingleNft(...Object.values(testConfig.validCallData))).to.be.rejectedWith(
            /Invalid rate value:/
          );
        });
        it('With royalties where parts_per_million is undefined', async () => {
          testConfig.validCallData.royalties[0].rate.parts_per_million = undefined;
          await expect(api.send.mintSingleNft(...Object.values(testConfig.validCallData))).to.be.rejectedWith(
            /Invalid rate value:/
          );
        });
        it('With multiple royalties where one of them is invalid', async () => {
          testConfig.validCallData.royalties = [
            {
              recipient_t1_address: royaltyRecipient1,
              rate: {
                parts_per_million: royaltyRate1
              }
            },
            {
              recipient_t1_address: 'invalid_format',
              rate: {
                parts_per_million: royaltyRate1
              }
            }
          ];
          await expect(api.send.mintSingleNft(...Object.values(testConfig.validCallData))).to.be.rejectedWith(
            /Invalid ethereum address type:/
          );
        });
      });
    });

    describe('listFiatNftForSale', async () => {
      describe('fails when called', async () => {
        testConfig = {
          validCallData: {
            nftId: unlistedUserNft
          },
          selectionField: undefined,
          testFunction: api.send.listFiatNftForSale
        };
        beforeEach(async () => {
          testConfig.validCallData = {
            nftId: unlistedUserNft
          };
        });
        describe('With invalid nft id', async () => {
          testConfig.selectionField = 'nftId';
          await testPatterns.invalidNftId(testConfig);
        });
        it('With user that doesnt own this nft', async () => {
          testConfig.validCallData.nftId = unlistedUserNft;
          await expect(api.send.listFiatNftForSale(...Object.values(testConfig.validCallData))).to.be.rejectedWith(
            /Invalid nftId type:/
          );
        });
        it('With an NFT that is already listed', async () => {
          testConfig.validCallData.nftId = listedUserNft;
          await expect(api.send.listFiatNftForSale(...Object.values(testConfig.validCallData))).to.be.rejectedWith(
            /Invalid nftId type:/
          );
        });
      });
    });

    describe('transferFiatNft', async () => {
      describe('fails when called', async () => {
        testConfig = {
          validCallData: {
            recipient: validOtherUser.address,
            nftId: listedUserNft
          },
          selectionField: undefined,
          testFunction: api.send.transferFiatNft
        };
        beforeEach(async () => {
          testConfig.validCallData = {
            recipient: validOtherUser.address,
            nftId: listedUserNft
          };
        });
        describe('With invalid account: recipient', async () => {
          testConfig.selectionField = 'recipient';
          await testPatterns.invalidAccount(testConfig);
        });
        describe('With invalid nft id', async () => {
          testConfig.selectionField = 'nftId';
          await testPatterns.invalidNftId(testConfig);
        });
        it('With user that doesnt own this nft', async () => {
          testConfig.validCallData.nftId = listedUserNft;
          await expect(api.send.transferFiatNft(...Object.values(testConfig.validCallData))).to.be.rejectedWith(
            /Invalid nftId type:/
          );
        });
        it('With an NFT that is not listed', async () => {
          testConfig.validCallData.nftId = unlistedUserNft;
          await expect(api.send.transferFiatNft(...Object.values(testConfig.validCallData))).to.be.rejectedWith(
            /Invalid nftId type:/
          );
        });
      });
    });

    describe('cancelFiatNftListing', async () => {
      describe('fails when called', async () => {
        testConfig = {
          validCallData: {
            nftId: listedUserNft
          },
          selectionField: undefined,
          testFunction: api.send.cancelFiatNftListing
        };
        beforeEach(async () => {
          testConfig.validCallData = {
            nftId: listedUserNft
          };
        });
        describe('With invalid nft id', async () => {
          testConfig.selectionField = 'nftId';
          await testPatterns.invalidNftId(testConfig);
        });
        it('With user that doesnt own this nft', async () => {
          testConfig.validCallData.nftId = listedUserNft;
          await expect(api.send.cancelFiatNftListing(...Object.values(testConfig.validCallData))).to.be.rejectedWith(
            /Invalid nftId type:/
          );
        });
        it('with an NFT that is not listed', async () => {
          testConfig.validCallData.nftId = unlistedUserNft;
          await expect(api.send.cancelFiatNftListing(...Object.values(testConfig.validCallData))).to.be.rejectedWith(
            /Invalid nftId type:/
          );
        });
      });
    });
  });
  run();
})();
