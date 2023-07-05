const AvnApi = require('avn-api');
const { accounts } = require('../config/accounts.json');
const axios = require('axios');
const { gateway, token } = require('../config/uat.json');

let api, payer, user, recipient, relayer, requestId;
const transferAmount = '1';

async function main() {
  api = new AvnApi();
  await api.init();
  payer = accounts.user;
  user = accounts.otherUser;
  recipient = accounts.avnValidator;
  relayer = accounts.relayer;
  requestId = 1;

  await logBalances('\nBALANCES BEFORE');

  // The user retrieves their token nonce,
  // then uses the api in offline mode to generate a signature for the transfer they wish to make
  await api.setSURI(user.seed);
  let userTokenNonce = await jsonRpcRequest('query', 'getNonce', { accountId: user.address, nonceType: 'token' });
  let userProxySignature = await userGeneratedProxyTokenTransferSignature(userTokenNonce);

  // We switch to the payer who takes the transfer signature the user generated,
  // gets their own fee and payment nonce, and then generates a payment signature using the api in offline mode
  await api.setSURI(payer.seed);
  let relayerFeeForPayer = await jsonRpcRequest('query', 'getRelayerFees', {
    relayer: relayer.address,
    user: payer.address,
    transactionType: 'proxyTokenTransfer'
  });
  let payerPaymentNonce = await jsonRpcRequest('query', 'getNonce', { accountId: payer.address, nonceType: 'payment' });
  let payerFeePaymentSignature = await payerGeneratedFeePaymentSignature(userProxySignature, relayerFeeForPayer, payerPaymentNonce);

  // No further signing required
  await api.setSURI(null);

  const proxyTokenTransferParams = {
    relayer: relayer.address,
    user: user.address,
    payer: payer.address,
    recipient: recipient.address,
    token: token,
    amount: transferAmount,
    proxySignature: userProxySignature,
    feePaymentSignature: payerFeePaymentSignature,
    paymentNonce: payerPaymentNonce
  };

  // The request gets sent
  await jsonRpcRequest('send', 'proxyTokenTransfer', proxyTokenTransferParams);
  await sleep(10 * 1000);
  await logBalances('\nBALANCES AFTER');
  await api.setSURI(user.seed);
}

async function userGeneratedProxyTokenTransferSignature(nonce) {
  const tokenTransferParams = {
    relayer: relayer.address,
    user: user.address,
    recipient: recipient.address,
    token: token,
    amount: transferAmount,
    nonce: nonce
  };

  return await api.proxy.generateProxySignature(api.signer(), 'proxyTokenTransfer', tokenTransferParams);
}

async function payerGeneratedFeePaymentSignature(proxySignature, relayerFee, paymentNonce) {
  const feePaymentParams = {
    relayer: relayer.address,
    user: user.address,
    proxySignature: proxySignature,
    relayerFee: relayerFee,
    paymentNonce: paymentNonce
  };

  return await api.proxy.generateFeePaymentSignature(feePaymentParams);
}

async function logBalances(heading) {
  console.log(heading);
  console.log('User AVT:\t', await jsonRpcRequest('query', 'getAvtBalance', { accountId: user.address }));
  console.log('User token:\t', await jsonRpcRequest('query', 'getTokenBalance', { accountId: user.address, token }));
  console.log('Recipient token:', await jsonRpcRequest('query', 'getTokenBalance', { accountId: recipient.address, token }));
  console.log('Payer AVT:\t', await jsonRpcRequest('query', 'getAvtBalance', { accountId: payer.address }));
}

async function jsonRpcRequest(path, method, params) {
  const awtToken = await api.awt.generateAwtToken(payer.seed); // payer generates all the AWT request tokens to access the gateway
  const url = `${gateway}/${path}`;
  const body = { jsonrpc: '2.0', id: requestId++, method, params };
  const headers = { 'content-type': 'application/json', Authorization: `bearer ${awtToken}` };
  let response = await axios.post(url, body, { headers });
  return response.data.result;
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

if (require.main === module) main();
