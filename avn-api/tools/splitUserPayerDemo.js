const AvnApi = require('../index.js');
const { accounts } = require('../config/accounts.json');
const axios = require('axios');
const gateway = 'https://sandbox.gateway.aventus.io';
const tokenAddress = '0xb2775da467266dfbc4bdfe8a7d9d7a5b1a15d954';

let api, payer, user, recipient, relayer, requestId;
const transferAmount = '1';

async function main() {
  api = new AvnApi();
  await api.init();
  payer = accounts.user;
  user = accounts.otherUser;
  recipient = accounts.otherUser2;
  relayer = accounts.relayer;
  requestId = 1;

  await logBalances('\nBALANCES BEFORE');

  process.env.SURI = user.seed;
  let userTokenNonce = await postJSONRPCRequest('query', 'getNonce', {accountId: user.address, nonceType: 'token'});
  const userProxyTokenTransferSignature = userGeneratesProxyTokenTransferSignature(userTokenNonce);

  process.env.SURI = payer.seed;
  let relayerFeeForPayer = await postJSONRPCRequest('query', 'getRelayerFees', {relayer: relayer.address, user: payer.address, transactionType: 'proxyTokenTransfer'});
  let payerPaymentNonce = await postJSONRPCRequest('query', 'getNonce', {accountId: payer.address, nonceType: 'payment'});
  const payerFeePaymentSignature = payerGeneratesFeePaymentSignature(userProxyTokenTransferSignature, relayerFeeForPayer, payerPaymentNonce);

  const proxyTokenTransferParams = {
    relayer: relayer.address,
    user: user.address,
    payer: payer.address,
    recipient: recipient.address,
    token: tokenAddress,
    amount: transferAmount,
    proxySignature: userProxyTokenTransferSignature,
    feePaymentSignature: payerFeePaymentSignature,
    paymentNonce: payerPaymentNonce,
  }

  await postJSONRPCRequest('send', 'proxyTokenTransfer', proxyTokenTransferParams);
  await sleep(10 * 1000);
  await logBalances('\nBALANCES AFTER');
}

function userGeneratesProxyTokenTransferSignature(nonce) {
  const tokenTransferParamsForUserSigning = {
    relayer: relayer.address,
    user: user.address,
    recipient: recipient.address,
    token: tokenAddress,
    amount: transferAmount,
    nonce
  }

  return api.proxy.generateProxySignature('proxyTokenTransfer', tokenTransferParamsForUserSigning);
}

function payerGeneratesFeePaymentSignature(proxySignature, relayerFee, paymentNonce) {
  const feePaymentParamsForPayerSigning = {
    relayer: relayer.address,
    user: user.address,
    proxySignature,
    relayerFee,
    paymentNonce
  }

  return api.proxy.generateFeePaymentSignature(feePaymentParamsForPayerSigning);
}

async function logBalances(heading) {
  console.log(heading);
  console.log('user AVT:       ', await postJSONRPCRequest('query', 'getAvtBalance', {accountId: user.address}));
  console.log('user token:     ', await postJSONRPCRequest('query', 'getTokenBalance', {accountId: user.address, token: tokenAddress}));
  console.log('recipient token:', await postJSONRPCRequest('query', 'getTokenBalance', {accountId: recipient.address, token: tokenAddress}));
  console.log('payer AVT:      ', await postJSONRPCRequest('query', 'getAvtBalance', {accountId: payer.address}));
}

async function postJSONRPCRequest(path, method, params) {
  const awtToken = api.awt.generateAwtToken(payer.seed); // payer generates all the AWT request tokens to access the gateway
  const url = `${gateway}/${path}`;
  const body = { jsonrpc: '2.0', id: requestId++, method, params };
  const headers = { 'content-type': 'application/json', 'Authorization': `bearer ${awtToken}` };
  let response = await axios.post(url, body, { headers });
  return response.data.result;
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

if (require.main === module) main();