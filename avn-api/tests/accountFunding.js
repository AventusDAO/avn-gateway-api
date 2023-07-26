const chai = require('chai');
const assert = chai.assert;
chai.use(require('chai-as-promised'));
const helper = require('./helper.js');
const accounts = helper.ACCOUNTS;
const BN = helper.BN;

const userMinBalance = new BN(helper.TWO_HUNDRED_ETH);
const relayerMinBalance = new BN(helper.TEN_ETH);
const receiverMinBalance = new BN(helper.ONE_ETH);

const userMinTokenBalance = new BN(helper.TEN_THOUSAND_WEI);

describe('Account funding', async () => {
  let api, user, receiver, relayer, userAvtBalance, receiverAvtBalance, relayerAvtBalance, userTokenBalance, amountInWei;

  before(async () => {
    process.env.AVN_SURI = accounts.bank.seed;

    const avnGateway = await helper.avnApi();
    api = await avnGateway.apis()

    relayer = accounts.relayer.address;
    user = accounts.user;
    receiver = accounts.otherUser;

    token = helper.token;

    userAvtBalance = new BN(await api.query.getAvtBalance(user.address));
    receiverAvtBalance = new BN(await api.query.getAvtBalance(receiver.address));
    relayerAvtBalance = new BN(await api.query.getAvtBalance(relayer));

    userTokenBalance = new BN(await api.query.getTokenBalance(user.address, token));
  });

  after(async () => {
    process.env.AVN_SURI = accounts.user.seed;
  });

  it('User Account Funded with AVT', async () => {
    if (userAvtBalance.lt(userMinBalance)) {
      amountInWei = userMinBalance.sub(userAvtBalance);

      const requestId = await api.send.transferAvt(user.address, amountInWei);
      await helper.confirmStatus(api, requestId, 'Processed');

      userAvtBalance = new BN(await api.query.getAvtBalance(user.address));
    }
    assert(userAvtBalance.gte(userMinBalance));
  });

  it('Receiver Account Funded with AVT', async () => {
    if (receiverAvtBalance.lt(receiverMinBalance)) {
      amountInWei = receiverMinBalance.sub(receiverAvtBalance);

      const requestId = await api.send.transferAvt(receiver.address, amountInWei);
      await helper.confirmStatus(api, requestId, 'Processed');

      receiverAvtBalance = new BN(await api.query.getAvtBalance(receiver.address));
    }
    assert(userAvtBalance.gte(receiverMinBalance));
  });

  it('Relayer Account Funded with AVT', async () => {
    if (relayerAvtBalance.lt(relayerMinBalance)) {
      amountInWei = relayerMinBalance.sub(relayerAvtBalance);

      const requestId = await api.send.transferAvt(relayer, amountInWei);
      await helper.confirmStatus(api, requestId, 'Processed');

      relayerAvtBalance = new BN(await api.query.getAvtBalance(relayer));
    }
    assert(relayerAvtBalance.gte(relayerMinBalance));
  });

  it('User Account Funded with env Token', async () => {
    if (userTokenBalance.lt(userMinTokenBalance)) {
      amountInWei = userMinTokenBalance.sub(userTokenBalance);

      const requestId = await api.send.transferToken(user.address, token, amountInWei);
      await helper.confirmStatus(api, requestId, 'Processed');

      userTokenBalance = new BN(await api.query.getTokenBalance(user.address, token));
    }
    assert(userTokenBalance.gte(userMinTokenBalance));
  });
});
