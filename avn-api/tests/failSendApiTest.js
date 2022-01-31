const chai = require('chai');
const expect = chai.expect;
const assert = chai.assert;
const testPatterns = require('./testPatterns.js');
chai.use(require('chai-as-promised'));
const helper = require('./helper.js');
const accounts = helper.ACCOUNTS;
const nfts = helper.NFTS;

// Immediately Invoked Function Expression to make async calls available before the test suite
// This makes run() method available to be called with --delay flag
(async function () {
  if (!nfts) {
    console.log('*** Please run: npm run generateState --gateway ***');
    return;
  }

  const api = await helper.avnApi();
  const validRelayer = accounts.relayer;
  const validSender = accounts.sender;
  const validUser = accounts.user1;
  const validToken = helper.token;

  const royaltyRecipient1 = '0xf8f77379A1C6b5CA66702b5943c5b229E310Ec03';
  const royaltyRecipient2 = '0xE566A65705F2d8D6C1Da9063A29b6F0f1Ac1e6Da';
  const royaltyRate1 = 10000;
  const royaltyRate2 = 20000;
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

  //Nfts owned by Sender
  const unlistedSenderNft = nfts.sender.unlistedNft;
  const listedSenderNft = nfts.sender.listedNft;

  //Nfts owned by User
  const unlistedUserNft = nfts.user.unlistedNft;
  const listedUserNft = nfts.user.listedNft;

  let testConfig;

  describe('Fail Send api calls:', async () => {
    describe('transferAvt', async () => {
      describe('fails when called', async () => {
        testConfig = {
          validCallData: {
            relayer: validRelayer.address,
            recipient: validUser.address,
            amount: 22
          },
          selectionField: undefined,
          testFunction: api.send.transferAvt
        };
        beforeEach(async () => {
          testConfig.validCallData = {
            relayer: validRelayer.address,
            recipient: validUser.address,
            amount: 22
          };
        });
        describe('With invalid account: relayer', async () => {
          testConfig.selectionField = 'relayer';
          await testPatterns.invalidAccount(testConfig);
        });
        describe('With invalid account: recipient', async () => {
          testConfig.selectionField = 'recipient';
          await testPatterns.invalidAccount(testConfig);
        });
        describe('With invalid amount', async () => {
          testConfig.selectionField = 'amount';
          await testPatterns.invalidAmount(testConfig);
        });
        //TODO: Fix error code 500 when relayer is not a relayer
        xit('With relayer address that is not a relayer', async () => {
          testConfig.validCallData.relayer = validSender.address;
          console.log(await api.send.transferAvt(...Object.values(testConfig.validCallData)));
        });
      });
    });

    describe('transferToken', async () => {
      describe('fails when called', async () => {
        testConfig = {
          validCallData: {
            relayer: validRelayer.address,
            recipient: validUser.address,
            token: validToken,
            amount: 22
          },
          selectionField: undefined,
          testFunction: api.send.transferToken
        };
        beforeEach(async () => {
          testConfig.validCallData = {
            relayer: validRelayer.address,
            recipient: validUser.address,
            token: validToken,
            amount: 22
          };
        });
        describe('With invalid account: relayer', async () => {
          testConfig.selectionField = 'relayer';
          await testPatterns.invalidAccount(testConfig);
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
        //TODO: Fix error code 500 when relayer is not a relayer
        xit('With relayer address that is not a relayer', async () => {
          testConfig.validCallData.relayer = validUser.address;
          console.log(await api.send.transferToken(...Object.values(testConfig.validCallData)));
        });
      });
    });

    describe('mintSingleNft', async () => {
      describe('fails when called', async () => {
        testConfig = {
          validCallData: {
            relayer: validRelayer.address,
            externalReference: externalRef,
            royalties: royalties,
            ethereumAddress: dummyT1Authority
          },
          selectionField: undefined,
          testFunction: api.send.mintSingleNft
        };
        beforeEach(async () => {
          testConfig.validCallData = {
            relayer: validRelayer.address,
            externalReference: externalRef,
            royalties: royalties,
            ethereumAddress: dummyT1Authority
          };
        });
        describe('With invalid account: relayer', async () => {
          testConfig.selectionField = 'relayer';
          await testPatterns.invalidAccount(testConfig);
        });
        describe('With invalid account: T1Authority', async () => {
          testConfig.selectionField = 'ethereumAddress';
          await testPatterns.invalidEthereumAddress(testConfig);
        });
        describe('With invalid external reference', async () => {
          testConfig.selectionField = 'externalReference';
          await testPatterns.invalidExternalReference(testConfig);
        });
        //TODO: Fix error code 500 when relayer is not a relayer
        xit('With relayer address that is not a relayer', async () => {
          testConfig.validCallData.relayer = validUser.address;
          console.log(await api.send.mintSingleNft(...Object.values(testConfig.validCallData)));
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
            /Cannot read property.*of undefined/
          );
        });
        it('With royalties where recipient address is empty string', async () => {
          testConfig.validCallData.royalties[0].recipient_t1_address = '';
          const requestId = await api.send.mintSingleNft(...Object.values(testConfig.validCallData));
          await helper.confirmStatus(api, requestId, 'Rejected');
        });
        it('With royalties where recipient address is undefined', async () => {
          testConfig.validCallData.royalties[0].recipient_t1_address = undefined;
          const requestId = await api.send.mintSingleNft(...Object.values(testConfig.validCallData));
          await helper.confirmStatus(api, requestId, 'Rejected');
        });
        it('With royalties where recipient address is in invalid format', async () => {
          testConfig.validCallData.royalties[0].recipient_t1_address = 'invalid_format';
          const requestId = await api.send.mintSingleNft(...Object.values(testConfig.validCallData));
          await helper.confirmStatus(api, requestId, 'Rejected');
        });
        it('With royalties where recipient address is short', async () => {
          testConfig.validCallData.royalties[0].recipient_t1_address = '0xf8f77379A1C6b5CA66702b5943c5b229E310Ec';
          const requestId = await api.send.mintSingleNft(...Object.values(testConfig.validCallData));
          await helper.confirmStatus(api, requestId, 'Rejected');
        });
        it('With royalties where recipient address is long', async () => {
          testConfig.validCallData.royalties[0].recipient_t1_address = '0xf8f77379A1C6b5CA66702b5943c5b229E310Ec03ab';
          const requestId = await api.send.mintSingleNft(...Object.values(testConfig.validCallData));
          await helper.confirmStatus(api, requestId, 'Rejected');
        });
        it('With royalties where parts_per_million not a number', async () => {
          testConfig.validCallData.royalties[0].rate.parts_per_million = 'string';
          const requestId = await api.send.mintSingleNft(...Object.values(testConfig.validCallData));
          await helper.confirmStatus(api, requestId, 'Rejected');
        });
        it('With royalties where parts_per_million is zero', async () => {
          testConfig.validCallData.royalties[0].rate.parts_per_million = 0;
          const requestId = await api.send.mintSingleNft(...Object.values(testConfig.validCallData));
          await helper.confirmStatus(api, requestId, 'Rejected');
        });
        it('With royalties where parts_per_million is not integer', async () => {
          testConfig.validCallData.royalties[0].rate.parts_per_million = 10.1;
          const requestId = await api.send.mintSingleNft(...Object.values(testConfig.validCallData));
          await helper.confirmStatus(api, requestId, 'Rejected');
        });
        it('With royalties where parts_per_million is bigger than 1,000,000', async () => {
          testConfig.validCallData.royalties[0].rate.parts_per_million = 1000001;
          const requestId = await api.send.mintSingleNft(...Object.values(testConfig.validCallData));
          await helper.confirmStatus(api, requestId, 'Rejected');
        });
        it('With royalties where parts_per_million is undefined', async () => {
          testConfig.validCallData.royalties[0].rate.parts_per_million = undefined;
          const requestId = await api.send.mintSingleNft(...Object.values(testConfig.validCallData));
          await helper.confirmStatus(api, requestId, 'Rejected');
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
          const requestId = await api.send.mintSingleNft(...Object.values(testConfig.validCallData));
          await helper.confirmStatus(api, requestId, 'Rejected');
        });
      });
    });

    describe('listFiatNftForSale', async () => {
      describe('fails when called', async () => {
        testConfig = {
          validCallData: {
            relayer: validRelayer.address,
            nftId: unlistedSenderNft
          },
          selectionField: undefined,
          testFunction: api.send.listFiatNftForSale
        };
        beforeEach(async () => {
          testConfig.validCallData = {
            relayer: validRelayer.address,
            nftId: unlistedSenderNft
          };
        });
        describe('With invalid account: relayer', async () => {
          testConfig.selectionField = 'relayer';
          await testPatterns.invalidAccount(testConfig);
        });
        describe('With invalid nft id', async () => {
          testConfig.selectionField = 'nftId';
          await testPatterns.invalidNftId(testConfig);
        });
        //TODO: Fix error code 500 when relayer is not a relayer
        xit('With relayer address that is not a relayer', async () => {
          testConfig.validCallData.relayer = validUser.address;
          console.log(await api.send.listFiatNftForSale(...Object.values(testConfig.validCallData)));
        });
        it('With sender that doesnt own this nft', async () => {
          testConfig.validCallData.nftId = unlistedUserNft;
          const requestId = await api.send.listFiatNftForSale(...Object.values(testConfig.validCallData));
          await helper.confirmStatus(api, requestId, 'Rejected');
        });
        it('With an NFT that is already listed', async () => {
          testConfig.validCallData.nftId = listedSenderNft;
          const requestId = await api.send.listFiatNftForSale(...Object.values(testConfig.validCallData));
          await helper.confirmStatus(api, requestId, 'Rejected');
        });
      });
    });

    describe('transferFiatNft', async () => {
      describe('fails when called', async () => {
        testConfig = {
          validCallData: {
            relayer: validRelayer.address,
            recipient: validUser.address,
            nftId: listedSenderNft
          },
          selectionField: undefined,
          testFunction: api.send.transferFiatNft
        };
        beforeEach(async () => {
          testConfig.validCallData = {
            relayer: validRelayer.address,
            recipient: validUser.address,
            nftId: listedSenderNft
          };
        });
        describe('With invalid account: relayer', async () => {
          testConfig.selectionField = 'relayer';
          await testPatterns.invalidAccount(testConfig);
        });
        //TODO: Error returns 'Cannot read property 'proxyTransferFiatNft' of undefined'
        // instead of addressing the bad recipient address
        xdescribe('With invalid account: recipient', async () => {
          testConfig.selectionField = 'recipient';
          await testPatterns.invalidAccount(testConfig);
        });
        describe('With invalid nft id', async () => {
          testConfig.selectionField = 'nftId';
          await testPatterns.invalidNftId(testConfig);
        });
        //TODO: Fix error code 500
        xit('With relayer address that is not a relayer', async () => {
          testConfig.validCallData.relayer = validUser.address;
          console.log(await api.send.transferFiatNft(...Object.values(testConfig.validCallData)));
        });
        it('With sender that doesnt own this nft', async () => {
          testConfig.validCallData.nftId = listedUserNft;
          const requestId = await api.send.transferFiatNft(...Object.values(testConfig.validCallData));
          await helper.confirmStatus(api, requestId, 'Rejected');
        });
        //TODO: Fix error code 500
        it('With an NFT that is not listed', async () => {
          testConfig.validCallData.nftId = unlistedSenderNft;
          const requestId = await api.send.transferFiatNft(...Object.values(testConfig.validCallData));
          await helper.confirmStatus(api, requestId, 'Rejected');
        });
      });
    });

    describe('cancelFiatNftListing', async () => {
      describe('fails when called', async () => {
        testConfig = {
          validCallData: {
            relayer: validRelayer.address,
            nftId: listedSenderNft
          },
          selectionField: undefined,
          testFunction: api.send.cancelFiatNftListing
        };
        beforeEach(async () => {
          testConfig.validCallData = {
            relayer: validRelayer.address,
            nftId: listedSenderNft
          };
        });
        describe('With invalid account: relayer', async () => {
          testConfig.selectionField = 'relayer';
          await testPatterns.invalidAccount(testConfig);
        });
        describe('With invalid nft id', async () => {
          testConfig.selectionField = 'nftId';
          await testPatterns.invalidNftId(testConfig);
        });
        //TODO: Fix error code 500 when relayer is not a relayer
        xit('With relayer address that is not a relayer', async () => {
          testConfig.validCallData.relayer = validUser.address;
          console.log(await api.send.cancelFiatNftListing(...Object.values(testConfig.validCallData)));
        });
        it('With sender that doesnt own this nft', async () => {
          testConfig.validCallData.nftId = listedUserNft;
          const requestId = await api.send.cancelFiatNftListing(...Object.values(testConfig.validCallData));
          await helper.confirmStatus(api, requestId, 'Rejected');
        });
        it('with an NFT that is not listed', async () => {
          testConfig.validCallData.nftId = unlistedSenderNft;
          const requestId = await api.send.cancelFiatNftListing(...Object.values(testConfig.validCallData));
          await helper.confirmStatus(api, requestId, 'Rejected');
        });
      });
    });
  });
  run();
})();
