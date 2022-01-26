const chai = require('chai');
const expect = chai.expect;
const assert = chai.assert;
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

  const royaltyRecipient1 = '0xf8f77379A1C6b5CA66702b5943c5b229E310Ec03';
  const royaltyRecipient2 = '0xE566A65705F2d8D6C1Da9063A29b6F0f1Ac1e6Da';
  const royaltyRate1 = 10000;
  const royaltyRate2 = 20000;

  const externalRef = 'avn-gateway-test-' + new Date().toISOString();
  const externalRef2 = 'avn-gateway-test2-' + new Date().toISOString();
  const externalRef3 = 'avn-gateway-test3-' + new Date().toISOString();
  const externalRef4 = 'avn-gateway-test4-' + new Date().toISOString();

  const dummyT1Authority = '0xd6ae8250b8348c94847280928c79fb3b63ca453e';
  const royalties = [
    {
      recipient_t1_address: royaltyRecipient1,
      rate: {
        parts_per_million: royaltyRate1
      }
    }
  ];

  //Unlisted NFT owned by sender
  let requestId = await api.send.mintSingleNft(validRelayer.address, externalRef, royalties, dummyT1Authority);
  await helper.confirmStatus(api, requestId, 'Processed');
  const unlistedNftId = await api.query.getNftId(externalRef);

  // //Unlisted NFT owned by user
  requestId = await api.send.mintSingleNft(validRelayer.address, externalRef2, royalties, dummyT1Authority);
  await helper.confirmStatus(api, requestId, 'Processed');
  const unlistedUserNft = await api.query.getNftId(externalRef2);
  requestId = await api.send.listFiatNftForSale(validRelayer.address, unlistedUserNft);
  await helper.confirmStatus(api, requestId, 'Processed');
  await api.send.transferFiatNft(validRelayer.address, validUser.address, unlistedUserNft);
  await api.send.cancelFiatNftListing(validRelayer.address, unlistedUserNft);

  //Listed NFT owned by sender
  requestId = await api.send.mintSingleNft(validRelayer.address, externalRef3, royalties, dummyT1Authority);
  await helper.confirmStatus(api, requestId, 'Processed');
  const listedNftId = await api.query.getNftId(externalRef3);
  requestId = await api.send.listFiatNftForSale(validRelayer.address, listedNftId);
  await helper.confirmStatus(api, requestId, 'Processed');

  //Listed NFT owned by user
  requestId = await api.send.mintSingleNft(validRelayer.address, externalRef4, royalties, dummyT1Authority);
  await helper.confirmStatus(api, requestId, 'Processed');
  const listedUserNft = await api.query.getNftId(externalRef4);
  requestId = await api.send.listFiatNftForSale(validRelayer.address, listedUserNft);
  await helper.confirmStatus(api, requestId, 'Processed');
  await api.send.transferFiatNft(validRelayer.address, validUser.address, listedUserNft);

  describe('Fail Send api calls:', async () => {
    describe('transferAvt', async () => {
      describe('fails when called', async () => {
        let validCallData = {
          relayer: validRelayer.address,
          recipient: validUser.address,
          amount: 22
        };
        beforeEach(async () => {
          validCallData = {
            relayer: validRelayer.address,
            recipient: validUser.address,
            amount: 22
          };
        });
        describe('With invalid account: relayer', async () => {
          await testPatterns.invalidAccount('Relayer', 'relayer', validCallData, api.send.transferAvt);
        });
        describe('With invalid account: recipient', async () => {
          await testPatterns.invalidAccount('Recipient', 'recipient', validCallData, api.send.transferAvt);
        });
        describe('With invalid amount', async () => {
          await testPatterns.invalidAmount('AVT Amount', 'amount', validCallData, api.send.transferAvt);
        });
        //TODO: Fix error code 500 when relayer is not a relayer
        xit('With relayer address that is not a relayer', async () => {
          validCallData['relayer'] = validSender.address;
          console.log(await api.send.transferAvt(...Object.values(validCallData)));
        });
      });
    });

    describe('transferToken', async () => {
      describe('fails when called', async () => {
        let validCallData = {
          relayer: validRelayer.address,
          recipient: validUser.address,
          token: validToken,
          amount: 22
        };
        beforeEach(async () => {
          validCallData = {
            relayer: validRelayer.address,
            recipient: validUser.address,
            token: validToken,
            amount: 22
          };
        });
        describe('With invalid account: relayer', async () => {
          await testPatterns.invalidAccount('Relayer', 'relayer', validCallData, api.send.transferToken);
        });
        describe('With invalid account: recipient', async () => {
          await testPatterns.invalidAccount('Recipient', 'recipient', validCallData, api.send.transferToken);
        });
        describe('With invalid token', async () => {
          await testPatterns.invalidEthereumToken('Token', 'token', validCallData, api.send.transferToken);
        });
        describe('With invalid token amount', async () => {
          await testPatterns.invalidAmount('Token amount', 'amount', validCallData, api.send.transferToken);
        });
        //TODO: Fix error code 500 when relayer is not a relayer
        xit('With relayer address that is not a relayer', async () => {
          validCallData['relayer'] = validUser.address;
          console.log(await api.send.transferToken(...Object.values(validCallData)));
        });
      });
    });

    describe('mintSingleNft', async () => {
      describe('fails when called', async () => {
        let validCallData = {
          relayer: validRelayer.address,
          externalReference: externalRef,
          royalties: royalties,
          T1Authority: dummyT1Authority
        };
        beforeEach(async () => {
          validCallData = {
            relayer: validRelayer.address,
            externalReference: externalRef,
            royalties: royalties,
            T1Authority: dummyT1Authority
          };
        });
        describe('With invalid account: relayer', async () => {
          await testPatterns.invalidAccount('Relayer', 'relayer', validCallData, api.send.mintSingleNft);
        });
        describe('With invalid account: T1Authority', async () => {
          await testPatterns.invalidEthereumAccount('T1Authority', 'T1Authority', validCallData, api.send.mintSingleNft);
        });
        describe('With invalid external reference', async () => {
          await testPatterns.invalidExternalReference(
            'External reference',
            'externalReference',
            validCallData,
            api.send.mintSingleNft
          );
        });
        //TODO: Fix error code 500 when relayer is not a relayer
        xit('With relayer address that is not a relayer', async () => {
          validCallData['relayer'] = validUser.address;
          console.log(await api.send.mintSingleNft(...Object.values(validCallData)));
        });

        it('With royalties as undefined', async () => {
          validCallData['royalties'] = undefined;
          await expect(api.send.mintSingleNft(...Object.values(validCallData))).to.be.rejectedWith(/Invalid array type:/);
        });
        it('With royalties with invalid JSON format', async () => {
          validCallData['royalties'] = [
            {
              recipient_t1_address: royaltyRecipient1,
              parts_per_million: royaltyRate1
            }
          ];
          await expect(api.send.mintSingleNft(...Object.values(validCallData))).to.be.rejectedWith(/Cannot read property/);
        });
        //TODO: Should return an error
        xit('With royalties where recipient address is empty string', async () => {
          validCallData.royalties[0].recipient_t1_address = '';
          await expect(api.send.mintSingleNft(...Object.values(validCallData))).to.be.rejectedWith(Error);
        });
        //TODO: Should return an error
        xit('With royalties where recipient address is undefined', async () => {
          validCallData.royalties[0].recipient_t1_address = undefined;
          await expect(api.send.mintSingleNft(...Object.values(validCallData))).to.be.rejectedWith(Error);
        });
        //TODO: Should return an error
        xit('With royalties where recipient address is in invalid format', async () => {
          validCallData.royalties[0].recipient_t1_address = 'invalid_format';
          await expect(api.send.mintSingleNft(...Object.values(validCallData))).to.be.rejectedWith(Error);
        });
        //TODO: Should return an error
        xit('With royalties where recipient address is short', async () => {
          validCallData.royalties[0].recipient_t1_address = '0xf8f77379A1C6b5CA66702b5943c5b229E310Ec0';
          await expect(api.send.mintSingleNft(...Object.values(validCallData))).to.be.rejectedWith(Error);
        });
        //TODO: Should return an error
        xit('With royalties where recipient address is long', async () => {
          validCallData.royalties[0].recipient_t1_address = '0xf8f77379A1C6b5CA66702b5943c5b229E310Ec035';
          await expect(api.send.mintSingleNft(...Object.values(validCallData))).to.be.rejectedWith(Error);
        });
        //TODO: Should return an error
        xit('With royalties where parts_per_million not a number', async () => {
          validCallData.royalties[0].rate.parts_per_million = 'string';
          await expect(api.send.mintSingleNft(...Object.values(validCallData))).to.be.rejectedWith(Error);
        });
        //TODO: Should return an error
        xit('With royalties where parts_per_million is zero', async () => {
          validCallData.royalties[0].rate.parts_per_million = 0;
          await expect(api.send.mintSingleNft(...Object.values(validCallData))).to.be.rejectedWith(Error);
        });
        //TODO: Should return an error
        xit('With royalties where parts_per_million is not integer', async () => {
          validCallData.royalties[0].rate.parts_per_million = 10.1;
          await expect(api.send.mintSingleNft(...Object.values(validCallData))).to.be.rejectedWith(Error);
        });
        //TODO: Should return an error
        xit('With royalties where parts_per_million is bigger than 1,000,000', async () => {
          validCallData.royalties[0].rate.parts_per_million = 100000000;
          await expect(api.send.mintSingleNft(...Object.values(validCallData))).to.be.rejectedWith(Error);
        });
        //TODO: Should return an error
        xit('With royalties where parts_per_million is undefined', async () => {
          validCallData.royalties[0].rate.parts_per_million = undefined;
          await expect(api.send.mintSingleNft(...Object.values(validCallData))).to.be.rejectedWith(Error);
        });
        //TODO: Should return an error
        xit('With multiple royalties where one of them is invalid', async () => {
          validCallData['royalties'] = [
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
          await expect(api.send.mintSingleNft(...Object.values(validCallData))).to.be.rejectedWith(Error);
        });
      });
    });

    describe('listFiatNftForSale', async () => {
      describe('fails when called', async () => {
        let validCallData = {
          relayer: validRelayer.address,
          nftId: unlistedNftId
        };
        beforeEach(async () => {
          validCallData = {
            relayer: validRelayer.address,
            nftId: unlistedNftId
          };
        });
        describe('With invalid account: relayer', async () => {
          await testPatterns.invalidAccount('Relayer', 'relayer', validCallData, api.send.listFiatNftForSale);
        });
        describe('With invalid nft id', async () => {
          await testPatterns.invalidNftId('Nft id', 'nftId', validCallData, api.send.listFiatNftForSale);
        });
        //TODO: Fix error code 500 when relayer is not a relayer
        xit('With relayer address that is not a relayer', async () => {
          validCallData['relayer'] = validUser.address;
          console.log(await api.send.listFiatNftForSale(...Object.values(validCallData)));
        });
        //TODO: This should return an error
        xit('With sender that doesnt own this nft', async () => {
          validCallData['nftId'] = unlistedUserNft;
          await expect(api.send.listFiatNftForSale(...Object.values(validCallData))).to.be.rejectedWith(Error);
        });
        //TODO: This should return an error
        xit('With an NFT that is already listed', async () => {
          validCallData['nftId'] = listedNftId;
          await expect(api.send.listFiatNftForSale(...Object.values(validCallData))).to.be.rejectedWith(Error);
        });
      });
    });

    describe('transferFiatNft', async () => {
      describe('fails when called', async () => {
        let validCallData = {
          relayer: validRelayer.address,
          recipient: validUser.address,
          nftId: listedNftId
        };
        beforeEach(async () => {
          validCallData = {
            relayer: validRelayer.address,
            recipient: validUser.address,
            nftId: listedNftId
          };
        });
        describe('With invalid account: relayer', async () => {
          await testPatterns.invalidAccount('Relayer', 'relayer', validCallData, api.send.transferFiatNft);
        });
        //TODO: Error returns 'Cannot read property 'proxyTransferFiatNft' of undefined'
        // instead of addressing the bad recipient address
        xdescribe('With invalid account: recipient', async () => {
          await testPatterns.invalidAccount('Recipient', 'recipient', validCallData, api.send.transferFiatNft);
        });
        describe('With invalid nft id', async () => {
          await testPatterns.invalidNftId('Nft id', 'nftId', validCallData, api.send.transferFiatNft);
        });
        //TODO: This should return an error
        xit('With sender that doesnt own this nft', async () => {
          validCallData['nftId'] = listedUserNft;
          await expect(api.send.transferFiatNft(...Object.values(validCallData))).to.be.rejectedWith(Error);
        });
        //TODO: Fix error code 500
        xit('With relayer address that is not a relayer', async () => {
          validCallData['relayer'] = validUser.address;
        });
        //TODO: Fix error code 500
        xit('With an NFT that is not listed', async () => {
          validCallData['relayer'] = unlistedNftId;
          await expect(api.send.transferFiatNft(...Object.values(validCallData))).to.be.rejectedWith(Error);
        });
      });
    });

    describe('cancelFiatNftListing', async () => {
      describe('fails when called', async () => {
        let validCallData = {
          relayer: validRelayer.address,
          nftId: listedNftId
        };
        beforeEach(async () => {
          validCallData = {
            relayer: validRelayer.address,
            nftId: listedNftId
          };
        });
        describe('With invalid account: relayer', async () => {
          await testPatterns.invalidAccount('Relayer', 'relayer', validCallData, api.send.cancelFiatNftListing);
        });
        describe('With invalid nft id', async () => {
          await testPatterns.invalidNftId('Nft id', 'nftId', validCallData, api.send.cancelFiatNftListing);
        });
        //TODO: Fix error code 500 when relayer is not a relayer
        xit('With relayer address that is not a relayer', async () => {
          validCallData['relayer'] = validUser.address;
        });
        //TODO: Should return an error
        xit('With sender that doesnt own this nft', async () => {
          validCallData['nftId'] = listedUserNft;
          await expect(api.send.cancelFiatNftListing(...Object.values(validCallData))).to.be.rejectedWith(Error);
        });
        //TODO: Fix error code 500
        xit('with an NFT that is not listed', async () => {
          validCallData['relayer'] = unlistedNftId;
          await expect(api.send.cancelFiatNftListing(...Object.values(validCallData))).to.be.rejectedWith(Error);
        });
      });
    });
  });
  run();
})();
