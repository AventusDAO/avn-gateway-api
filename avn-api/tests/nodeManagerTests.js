const assert = require('chai').assert;
const { SetupMode, SigningMode } = require('avn-api');
const helper = require('./helper.js');

const accounts = helper.ACCOUNTS;

describe('Node manager tests', async () => {
  let api, node;
  let owner = accounts.user;
  let nodeManager = accounts.nodeManager;

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

    avnGateway = await helper.avnApi(options);
    api = await avnGateway.apis(nodeManager.address);
    node = avnGateway.accountUtils.generateNewAccount();
  });

  describe('Register node', function () {
    let requestId, nodeManagerInfoBefore, nodeManagerInfoAfter;
    before(async () => {
      nodeManagerInfoBefore = await api.query.getNodeManagerInfo();
      requestId = await api.send.registerNode(node.address, owner.address, node.publicKey);
    });

    describe('succeeds if', async function () {
      it('Request is processed', async function () {
        await helper.confirmStatus(api.poll, requestId, 'Processed');
        nodeManagerInfoAfter = await api.query.getNodeManagerInfo();
      });
      it('Total number of nodes increases', async function () {
        assert.equal(nodeManagerInfoBefore.totalRegisteredNodes + 1, nodeManagerInfoAfter.totalRegisteredNodes);
      });
    });
  });
});
