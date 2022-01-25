const BN = require('bn.js');
const colors = require('colors');
const prompt = require('prompt-sync')();
const yargs = require('yargs');
const { accounts } = require('./demo-accounts-testnet.json');
const AvnApi = require('avn-api');
const { Keyring } = require('@polkadot/keyring');
const keyring = new Keyring({ type: 'sr25519', ss58Format: 42 });

const dummyT1Authority = '0xd6ae8250b8348c94847280928c79fb3b63ca453e';

async function main() {
  const argv = yargs
    .strict()
    .string('config')
    .alias('config', 'c')
    .demandOption('config')
    .describe('config', 'Environment definitions').argv;

  let config = argv.config;

  const CONFIG = require(config);
  let api = await avnApi(CONFIG.gateway);

  let totalAVT = new BN(await api.query.getTotalAvt());
  console.log('Total Chain AVT balance'.magenta, totalAVT.toString());

  let SENDER = await initAccount(accounts.sender.mnemonic);
  let relayerAddress = CONFIG.relayer;
  let receiverAddress = CONFIG.receiver;

  console.log(`Account balances`.bold);
  let senderBalance = new BN(await queryBalance(api, SENDER.address));
  let relayerBalance = new BN(await queryBalance(api, relayerAddress));
  let receiverBalance = new BN(await queryBalance(api, receiverAddress));
  console.log(`Sender   [${SENDER.address}]: `.brightBlue + `${formatBalance(senderBalance)}`);
  console.log(`Relayer  [${relayerAddress}]: `.brightBlue + `${formatBalance(relayerBalance)}`);
  console.log(`Receiver [${receiverAddress}]: `.brightBlue + `${formatBalance(receiverBalance)}`);

  prompt('\nPress Enter to Transfer Demo');

  let txFee;
  try {
    txFee = await api.query.getRelayerFees(relayerAddress, SENDER.address);
  } catch (err) {
    console.log('Error obtaining fees', err);
    txFee = 'N/A';
  }
  console.log('Fees:', txFee);

  let amount = new BN(1000);
  try {
    console.log(`\nTransferring ${amount} AVT from Sender to Receiver`.magenta);
    const requestId = await api.send.transferAvt(relayerAddress, receiverAddress, amount.toString());
    await confirmStatus(api, requestId, 'Processed');
  } catch (err) {
    console.log('Error sending transferAVT transaction', err);
  }

  let newSenderBalance = new BN(await queryBalance(api, SENDER.address));
  let newRelayerBalance = new BN(await queryBalance(api, relayerAddress));
  let newReceiverBalance = new BN(await queryBalance(api, receiverAddress));
  console.log(`Sender   [${SENDER.address}]: `.brightBlue + `${formatBalance(newSenderBalance)}`);
  console.log(`Relayer  [${relayerAddress}]: `.brightBlue + `${formatBalance(newRelayerBalance)}`);
  console.log(`Receiver [${receiverAddress}]: `.brightBlue + `${formatBalance(newReceiverBalance)}`);

  let relayerGain = newRelayerBalance.sub(relayerBalance);
  let senderPaid = senderBalance.sub(newSenderBalance);

  let relayerFees = senderPaid.sub(amount);
  let networkFees = relayerFees.sub(relayerGain);
  let receiverGain = newReceiverBalance.sub(receiverBalance);

  console.log(`Receiver's gain: ${receiverGain}`.yellow.bold);
  console.log();
  console.log(`Sender's cost: ${senderPaid}`.bold);
  console.log(`= Amount sent: ${amount}`.yellow.bold);
  console.log(`+ Relayer fee: ${relayerFees}`.red);
  console.log();
  console.log(`Relayer gain : ${relayerGain}`.bold);
  console.log(`= Relayer fee: ${relayerFees}`);
  console.log(`- Network fee: ${networkFees}`.red);

  prompt('\n\nPress Enter for NFT Demo');

  let royalties = getRoyalties();
  let externalRef = createExternalRef();
  let nftId;
  try {
    console.log('\nMinting new NFT'.magenta);
    const requestId = await api.send.mintSingleNft(relayerAddress, externalRef, royalties, dummyT1Authority);
    await confirmStatus(api, requestId, 'Processed');
    nftId = await api.query.getNftId(externalRef);
    console.log(`Minted new NFT: ${nftId} with ref ${externalRef}`);
  } catch (err) {
    console.log('Error sending mint NFT transaction', err);
  }

  try {
    console.log(`\nListing NFT for sale: ${nftId}`.magenta);
    let requestId = await api.send.listFiatNftForSale(relayerAddress, nftId);
    await confirmStatus(api, requestId, 'Processed');

    console.log(`\nand transferring it to ${SENDER.address}`.magenta);
    requestId = await api.send.transferFiatNft(relayerAddress, SENDER.address, nftId);
    await confirmStatus(api, requestId, 'Processed');
  } catch (err) {
    console.log('Error sending list NFT transaction', err);
  }

  try {
    console.log(`\nRe-Listing NFT for sale: ${nftId}`.magenta);
    let requestId = await api.send.listFiatNftForSale(relayerAddress, nftId);
    await confirmStatus(api, requestId, 'Processed');

    console.log(`but cancelling the sale`);
    requestId = await api.send.cancelFiatNftListing(relayerAddress, nftId);
  } catch (err) {
    console.log('Error sending list NFT transaction', err);
  }
}

function getRoyalties() {
  let royalties = [];
  royaltyRecipient1 = '0xf8f77379A1C6b5CA66702b5943c5b229E310Ec03';
  royaltyRecipient2 = '0xE566A65705F2d8D6C1Da9063A29b6F0f1Ac1e6Da';
  royaltyRate1 = 10000;
  royaltyRate2 = 20000;

  return royalties;
}

function createExternalRef() {
  return 'avn-gateway-test-' + new Date().toISOString(); // This must be unique across all mints
}

async function avnApi(gateway) {
  console.log(`Connecting to Avn @ ${gateway}`.red);
  const api = new AvnApi(gateway);
  await api.init();
  console.log(`Connected to Avn @ ${gateway}`.green);
  return api;
}

async function initAccount(suri) {
  return keyring.addFromUri(suri);
}

async function queryBalance(api, address) {
  let balance = await api.query.getAvtBalance(address);
  return balance.toString();
}

async function confirmStatus(api, requestId, expectedStatus) {
  console.log(`Waiting to confirm gateway request ${requestId}...`);
  if (!requestId) throw new Error('RequestId cannot be null');

  for (i = 0; i < 10; i++) {
    await sleep(3000);
    const status = await api.poll.requestState(requestId);
    if (status !== 'Pending' && status !== 'Transaction not found') {
      if (status !== expectedStatus) console.log(`Unexpected different status: ${status} - ${expectedStatus}`.red);
      break;
    }
  }
  console.log(`... confirmed!`);
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function formatBalance(balanceAsBN) {
  let balanceAsStr = balanceAsBN.toString();
  if (balanceAsStr.length > 18) {
    let units = balanceAsStr.substring(0, balanceAsStr.length - 18);
    let remainder = balanceAsStr.substring(units.length);
    if (units.length < 3) {
      let leadingZeroes = new Array(3 - units.length + 1).join(' ');
      units = leadingZeroes + units;
    }
    return `${units}.${remainder} AVT`;
  } else if (balanceAsStr.length > 15) {
    let units = balanceAsStr.substring(0, balanceAsStr.length - 15);
    let remainder = balanceAsStr.substring(units.length);
    return `${units}.${remainder} milliAVT`;
  } else return balanceAsStr;
}

(async () => {
  await main();
})().catch(e => {
  console.log(e.toString());
  process.exit(1);
});
