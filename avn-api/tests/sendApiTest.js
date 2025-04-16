const assert = require('chai').assert;
const { SetupMode, SigningMode } = require('avn-api');
const helper = require('./helper.js');
const accounts = helper.ACCOUNTS;
const BN = helper.BN;
const bnEquals = helper.bnEquals;
const MINIMUM_REQUIRED_AVT_TEST_BALANCE = helper.convertToBaseUnits(1);
const MINIMUM_REQUIRED_TOKEN_TEST_BALANCE = new BN('100');

const dummyT1Authority = '0xd6ae8250b8348c94847280928c79fb3b63ca453e';

describe('SendTx api calls:', async () => {
  let api;
  let token, avt;
  let relayer, user, recipient, payer, t1Recipient;
  let relayerFee, relayerLowerFee;

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

    token = helper.token;
    relayer = accounts.relayer.address;
    user = accounts.user.address;
    recipient = accounts.otherUser.address;
    recipientPubKey = accounts.otherUser.publicKey;

    avnGateway = await helper.avnApi(options);
    api = await avnGateway.apis(user);
    bankApi = await avnGateway.apis(accounts.bank.address);
    avt = await api.query.getAvtContractAddress();

    relayerFee = new BN((await api.query.getRelayerFees(relayer, avt, user)).proxyAvtTransfer);
    relayerLowerFee = new BN((await api.query.getRelayerFees(relayer, avt, user)).proxyTokenLower);
    t1Recipient = '0xFad45995bc1ceE164E7565e301F5736F3eed3Bb1'; // a dummy recipient as we are not checking the full lower path
  });

  describe('Test setup', function () {
    let senderBalance, senderTokenBalance;
    before(async () => {
      senderBalance = new BN(await api.query.getAvtBalance(user));
      senderTokenBalance = new BN(await api.query.getTokenBalance(user, token));
    });

    describe('succeeds if', async function () {
      it('sender is funded with Avt', async function () {
        console.log(`senderBalance: ${JSON.stringify(senderBalance, null, 2)}`);
        console.log(`senderBalance: ${senderBalance.toString()}`);
        console.log(`MINIMUM_REQUIRED_AVT_TEST_BALANCE: ${JSON.stringify(MINIMUM_REQUIRED_AVT_TEST_BALANCE, null, 2)}`);
        console.log(`MINIMUM_REQUIRED_AVT_TEST_BALANCE: ${MINIMUM_REQUIRED_AVT_TEST_BALANCE.toString()}`);

        if (senderBalance.lt(MINIMUM_REQUIRED_AVT_TEST_BALANCE)) {
          let amountLeft = MINIMUM_REQUIRED_AVT_TEST_BALANCE.sub(senderBalance);
          console.log(`amountLeft: ${JSON.stringify(amountLeft, null, 2)}`);

          const requestId = await bankApi.send.transferAvt(user, amountLeft);
          await helper.confirmStatus(bankApi.poll, requestId, 'Processed');

          senderBalance = new BN(await api.query.getAvtBalance(user));
        }
        assert(senderBalance.gte(MINIMUM_REQUIRED_AVT_TEST_BALANCE));
      });

      it('sender is funded with erc20 token', async function () {
        if (senderTokenBalance.lt(MINIMUM_REQUIRED_TOKEN_TEST_BALANCE)) {
          let amountLeft = MINIMUM_REQUIRED_TOKEN_TEST_BALANCE.sub(senderTokenBalance);

          const requestId = await bankApi.send.transferToken(user, token, amountLeft);
          await helper.confirmStatus(bankApi.poll, requestId, 'Processed');

          senderTokenBalance = new BN(await api.query.getTokenBalance(user, token));
        }
        assert(senderTokenBalance.gte(MINIMUM_REQUIRED_TOKEN_TEST_BALANCE));
      });
    });
  });

  describe('transferAVT', async () => {
    let userAvtBalanceBefore, recipientAvtBalanceBefore, relayerAvtBalanceBefore;

    beforeEach(async () => {
      userAvtBalanceBefore = new BN(await api.query.getAvtBalance(user));
      recipientAvtBalanceBefore = new BN(await api.query.getAvtBalance(recipient));
      relayerAvtBalanceBefore = new BN(await api.query.getAvtBalance(relayer));
    });

    it('can transfer AVT using a recipient address', async () => {
      const amount = new BN(1);
      const requestId = await api.send.transferAvt(recipient, amount);
      await helper.confirmStatus(api.poll, requestId, 'Processed');

      bnEquals(recipientAvtBalanceBefore.add(amount), await api.query.getAvtBalance(recipient));
      bnEquals(userAvtBalanceBefore.sub(relayerFee).sub(amount), new BN(await api.query.getAvtBalance(user)));
      // TODO: include network fees when we've sorted the accounts out
      bnEquals(new BN(await api.query.getAvtBalance(relayer)).gte(relayerAvtBalanceBefore.add(relayerFee)));
    });

    it('can transfer AVT using a recipient public key', async () => {
      const amount = new BN(1);
      const requestId = await api.send.transferAvt(recipientPubKey, amount);
      await helper.confirmStatus(api.poll, requestId, 'Processed');

      bnEquals(recipientAvtBalanceBefore.add(amount), await api.query.getAvtBalance(recipientPubKey));
      bnEquals(userAvtBalanceBefore.sub(relayerFee).sub(amount), new BN(await api.query.getAvtBalance(user)));
      // TODO: include network fees when we've sorted the accounts out
      bnEquals(new BN(await api.query.getAvtBalance(relayer)).gte(relayerAvtBalanceBefore.add(relayerFee)));
    });

    it('can transfer AVT using a recipient address for a split fee user', async () => {
      let options = {
        suri: accounts.user.seed,
        hasPayer: true,
        payer: payer,
        relayer: relayer
      };

      let apiWithOptions = await helper.avnApi(options);
      let newApi = await apiWithOptions.apis();
      const amount = new BN(1);
      const requestId = await newApi.send.transferAvt(recipient, amount);
      console.log(`   - RequestId: ${requestId}`);
      await helper.confirmStatus(newApi.poll, requestId, 'Processed');

      bnEquals(recipientAvtBalanceBefore.add(amount), new BN(await newApi.query.getAvtBalance(recipient)));
    });
  });

  xdescribe('confirmTokenLift', async () => { // This tests always fails - returns rejected - should we remove it?
    it('can confirm a token lift', async () => {
      const dummyEthereumTransactionHash = helper.randomEthTxHash();
      const requestId = await api.send.confirmTokenLift(dummyEthereumTransactionHash);
      await helper.confirmStatus(api.poll, requestId, 'Validating');
    });
  });

  describe('lowerToken', async () => {
    let userAvtBalanceBefore, userTokenBalanceBefore, relayerAvtBalanceBefore, userNonceBefore;

    beforeEach(async () => {
      avnApi = await helper.avnApi({
        suri: accounts.user.seed
      });
      api = await avnApi.apis();

      userAvtBalanceBefore = new BN(await api.query.getAvtBalance(user));
      userTokenBalanceBefore = new BN(await api.query.getTokenBalance(user, token));
      relayerAvtBalanceBefore = new BN(await api.query.getAvtBalance(relayer));
      userNonceBefore = new BN(await api.query.getUserNonce(user, 'token'));
    });

    it('can lower tokens', async () => {
      const amount = new BN(1);
      const requestId = await api.send.lowerToken(t1Recipient, token, amount);
      await helper.confirmStatus(api.poll, requestId, 'Processed');

      // balance should remain the same since lower is not ready to claim at this point
      bnEquals(userTokenBalanceBefore, new BN(await api.query.getTokenBalance(user, token)));
      bnEquals(userNonceBefore.add(new BN(1)), new BN(await api.query.getUserNonce(user, 'token')));
      bnEquals(userAvtBalanceBefore.sub(relayerLowerFee), new BN(await api.query.getAvtBalance(user)));
      // TODO: include network fees when we've sorted the accounts out
      bnEquals(new BN(await api.query.getAvtBalance(relayer)).gte(relayerAvtBalanceBefore.add(relayerLowerFee)));
    });

    it('can lower AVT', async () => {
      const avtAddress = await api.query.getAvtContractAddress();
      const amount = new BN(1);
      const requestId = await api.send.lowerToken(t1Recipient, avtAddress, amount);
      await helper.confirmStatus(api.poll, requestId, 'Processed');

      bnEquals(userAvtBalanceBefore.sub(relayerLowerFee), new BN(await api.query.getAvtBalance(user)));
      bnEquals(userNonceBefore.add(new BN(1)), new BN(await api.query.getUserNonce(user, 'token')));
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
      const requestId = await api.send.mintSingleNft(externalRef, royalties, dummyT1Authority);
      await helper.confirmStatus(api.poll, requestId, 'Processed');
      nftId = await api.query.getNftId(externalRef);
      assert.equal(user, await api.query.getNftOwner(nftId));
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
      const requestId = await api.send.mintSingleNft(externalRef, royalties, dummyT1Authority);
      await helper.confirmStatus(api.poll, requestId, 'Processed');
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

      const requestId = await api.send.mintSingleNft(externalRef, royalties, dummyT1Authority);
      await helper.confirmStatus(api.poll, requestId, 'Processed');
    });
  });

  describe('listFiatNftForSale', async () => {
    let externalRef, nftId;
    const royalties = [];

    beforeEach(async () => {
      externalRef = 'avn-gateway-test-' + new Date().toISOString();
      const requestId = await api.send.mintSingleNft(externalRef, royalties, dummyT1Authority);
      await helper.confirmStatus(api.poll, requestId, 'Processed');
      nftId = await api.query.getNftId(externalRef);
    });

    it('can list an NFT as open for sale', async () => {
      const requestId = await api.send.listFiatNftForSale(nftId);
      await helper.confirmStatus(api.poll, requestId, 'Processed');
    });
  });

  describe('transferFiatNft', async () => {
    let externalRef, nftId;
    const royalties = [];

    beforeEach(async () => {
      externalRef = 'avn-gateway-test-' + new Date().toISOString();
      let requestId = await api.send.mintSingleNft(externalRef, royalties, dummyT1Authority);
      await helper.confirmStatus(api.poll, requestId, 'Processed');
      nftId = await api.query.getNftId(externalRef);
      requestId = await api.send.listFiatNftForSale(nftId);
      await helper.confirmStatus(api.poll, requestId, 'Processed');
    });

    it('can transfer an NFT after an offline fiat sale', async () => {
      assert.equal(user, await api.query.getNftOwner(nftId));
      const requestId = await api.send.transferFiatNft(recipient, nftId);
      await helper.confirmStatus(api.poll, requestId, 'Processed');
      assert.equal(recipient, await api.query.getNftOwner(nftId));
    });
  });

  describe('cancelFiatNftListing', async () => {
    let externalRef, nftId;
    const royalties = [];

    beforeEach(async () => {
      externalRef = 'avn-gateway-test-' + new Date().toISOString();
      let requestId = await api.send.mintSingleNft(externalRef, royalties, dummyT1Authority);
      await helper.confirmStatus(api.poll, requestId, 'Processed');
      nftId = await api.query.getNftId(externalRef);
      requestId = await api.send.listFiatNftForSale(nftId);
      await helper.confirmStatus(api.poll, requestId, 'Processed');
    });

    it('can cancel a fiat listing', async () => {
      const requestId = await api.send.cancelFiatNftListing(nftId);
      await helper.confirmStatus(api.poll, requestId, 'Processed');
    });
  });
});
