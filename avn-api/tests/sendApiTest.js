const assert = require('chai').assert;
const helper = require('./helper.js');
const accounts = helper.ACCOUNTS;
const BN = helper.BN;
const bnEquals = helper.bnEquals;

const dummyT1Authority = '0xd6ae8250b8348c94847280928c79fb3b63ca453e';

describe('SendTx api calls:', async () => {
  let api;
  let token;
  let relayer, sender, recipient, t1Recipient;
  let relayerFee, relayerLowerFee;

  before(async () => {
    api = await helper.avnApi();
    token = helper.token;
    relayer = accounts.relayer.address;
    sender = accounts.sender.address;
    recipient = accounts.user1.address;
    recipientPubKey = accounts.user1.publicKey;
    relayerFee = new BN((await api.query.getRelayerFees(relayer, sender)).proxyAvtTransfer);
    relayerLowerFee = new BN((await api.query.getRelayerFees(relayer, sender)).proxyTokenLower);
    t1Recipient = '0xFad45995bc1ceE164E7565e301F5736F3eed3Bb1'; // a dummy recipient as we are not checking the full lower path
  });

  describe('transferAVT', async () => {
    let senderAvtBalanceBefore, recipientAvtBalanceBefore, relayerAvtBalanceBefore;

    beforeEach(async () => {
      senderAvtBalanceBefore = new BN(await api.query.getAvtBalance(sender));
      recipientAvtBalanceBefore = new BN(await api.query.getAvtBalance(recipient));
      relayerAvtBalanceBefore = new BN(await api.query.getAvtBalance(relayer));
    });

    it('can transfer AVT using a recipient address', async () => {
      const amount = new BN(1);
      const requestId = await api.send.transferAvt(relayer, recipient, amount);
      await helper.confirmStatus(api, requestId, 'Processed');

      bnEquals(recipientAvtBalanceBefore.add(amount), await api.query.getAvtBalance(recipient));
      bnEquals(senderAvtBalanceBefore.sub(relayerFee).sub(amount), new BN(await api.query.getAvtBalance(sender)));
      // TODO: include network fees when we've sorted the accounts out
      bnEquals(new BN(await api.query.getAvtBalance(relayer)).gte(relayerAvtBalanceBefore.add(relayerFee)));
    });

    it('can transfer AVT using a recipient public key', async () => {
      const amount = new BN(2);
      const requestId = await api.send.transferAvt(relayer, recipientPubKey, amount);
      await helper.confirmStatus(api, requestId, 'Processed');

      bnEquals(recipientAvtBalanceBefore.add(amount), await api.query.getAvtBalance(recipientPubKey));
      bnEquals(senderAvtBalanceBefore.sub(relayerFee).sub(amount), new BN(await api.query.getAvtBalance(sender)));
      // TODO: include network fees when we've sorted the accounts out
      bnEquals(new BN(await api.query.getAvtBalance(relayer)).gte(relayerAvtBalanceBefore.add(relayerFee)));
    });
  });

  describe('lowerToken', async () => {
    let senderAvtBalanceBefore, senderTokenBalanceBefore, relayerAvtBalanceBefore, senderNonceBefore;

    beforeEach(async () => {
      senderAvtBalanceBefore = new BN(await api.query.getAvtBalance(sender));
      senderTokenBalanceBefore = new BN(await api.query.getTokenBalance(sender, token));
      relayerAvtBalanceBefore = new BN(await api.query.getAvtBalance(relayer));
      senderNonceBefore = new BN(await api.query.getAccountNonce(sender));
    });

    it('can lower tokens', async () => {
      const amount = new BN(2);
      const requestId = await api.send.lowerToken(relayer, t1Recipient, token, amount);
      await helper.confirmStatus(api, requestId, 'Processed');

      bnEquals(senderTokenBalanceBefore.sub(amount), new BN(await api.query.getTokenBalance(sender, token)));
      bnEquals(senderNonceBefore.add(new BN(1)), new BN(await api.query.getAccountNonce(sender)));
      bnEquals(senderAvtBalanceBefore.sub(relayerLowerFee), new BN(await api.query.getAvtBalance(sender)));
      // TODO: include network fees when we've sorted the accounts out
      bnEquals(new BN(await api.query.getAvtBalance(relayer)).gte(relayerAvtBalanceBefore.add(relayerLowerFee)));
    });

    it('can lower AVT', async () => {
      const avtAddress = await api.query.getAvtContractAddress();
      const amount = new BN(3);
      const requestId = await api.send.lowerToken(relayer, t1Recipient, avtAddress, amount);
      await helper.confirmStatus(api, requestId, 'Processed');

      bnEquals(senderAvtBalanceBefore.sub(relayerLowerFee).sub(amount), new BN(await api.query.getAvtBalance(sender)));
      bnEquals(senderNonceBefore.add(new BN(1)), new BN(await api.query.getAccountNonce(sender)));
      // TODO: include network fees when we've sorted the accounts out
      bnEquals(new BN(await api.query.getAvtBalance(relayer)).gte(relayerAvtBalanceBefore.add(relayerLowerFee)));
    });
  });

  describe('mintSingleNft', async () => {
    let externalRef, royalties, royaltyRecipient1, royaltyRecipient2, royaltyRate1, royaltyRate2;

    before(async () => {
      royalties = [];
      royaltyRecipient1 = '0xf8f77379A1C6b5CA66702b5943c5b229E310Ec03';
      royaltyRecipient2 = '0xE566A65705F2d8D6C1Da9063A29b6F0f1Ac1e6Da';
      royaltyRate1 = 10000;
      royaltyRate2 = 20000;
    });

    beforeEach(async () => {
      externalRef = 'avn-gateway-test-' + new Date().toISOString(); // This must be unique across all mints
    });

    it('can mint a single nft and confirm the owner', async () => {
      const requestId = await api.send.mintSingleNft(relayer, externalRef, royalties, dummyT1Authority);
      await helper.confirmStatus(api, requestId, 'Processed');
      nftId = await api.query.getNftId(externalRef);
      assert.equal(sender, await api.query.getNftOwner(nftId));
    });

    it('can mint single nft with a single royalty', async () => {
      royalties = [
        {
          recipient_t1_address: royaltyRecipient1,
          rate: {
            parts_per_million: royaltyRate1
          }
        }
      ];
      const requestId = await api.send.mintSingleNft(relayer, externalRef, royalties, dummyT1Authority);
      await helper.confirmStatus(api, requestId, 'Processed');
    });

    it('can mint single nft with multiple royalties', async () => {
      royalties = [
        {
          recipient_t1_address: royaltyRecipient1,
          rate: {
            parts_per_million: royaltyRate1
          }
        },
        {
          recipient_t1_address: royaltyRecipient2,
          rate: {
            parts_per_million: royaltyRate2
          }
        }
      ];

      const requestId = await api.send.mintSingleNft(relayer, externalRef, royalties, dummyT1Authority);
      await helper.confirmStatus(api, requestId, 'Processed');
    });
  });

  describe('listFiatNftForSale', async () => {
    let externalRef, nftId;
    const royalties = [];

    beforeEach(async () => {
      externalRef = 'avn-gateway-test-' + new Date().toISOString();
      const requestId = await api.send.mintSingleNft(relayer, externalRef, royalties, dummyT1Authority);
      await helper.confirmStatus(api, requestId, 'Processed');
      nftId = await api.query.getNftId(externalRef);
    });

    it('can list an NFT as open for sale', async () => {
      const requestId = await api.send.listFiatNftForSale(relayer, nftId);
      await helper.confirmStatus(api, requestId, 'Processed');
    });
  });

  describe('transferFiatNft', async () => {
    let externalRef, nftId;
    const royalties = [];

    beforeEach(async () => {
      externalRef = 'avn-gateway-test-' + new Date().toISOString();
      let requestId = await api.send.mintSingleNft(relayer, externalRef, royalties, dummyT1Authority);
      await helper.confirmStatus(api, requestId, 'Processed');
      nftId = await api.query.getNftId(externalRef);
      requestId = await api.send.listFiatNftForSale(relayer, nftId);
      await helper.confirmStatus(api, requestId, 'Processed');
    });

    it('can transfer an NFT after an offline fiat sale', async () => {
      assert.equal(sender, await api.query.getNftOwner(nftId));
      const requestId = await api.send.transferFiatNft(relayer, recipient, nftId);
      await helper.confirmStatus(api, requestId, 'Processed');
      assert.equal(recipient, await api.query.getNftOwner(nftId));
    });
  });

  describe('cancelFiatNftListing', async () => {
    let externalRef, nftId;
    const royalties = [];

    beforeEach(async () => {
      externalRef = 'avn-gateway-test-' + new Date().toISOString();
      let requestId = await api.send.mintSingleNft(relayer, externalRef, royalties, dummyT1Authority);
      await helper.confirmStatus(api, requestId, 'Processed');
      nftId = await api.query.getNftId(externalRef);
      requestId = await api.send.listFiatNftForSale(relayer, nftId);
      await helper.confirmStatus(api, requestId, 'Processed');
    });

    it('can cancel a fiat listing', async () => {
      const requestId = await api.send.cancelFiatNftListing(relayer, nftId);
      await helper.confirmStatus(api, requestId, 'Processed');
    });
  });
});
