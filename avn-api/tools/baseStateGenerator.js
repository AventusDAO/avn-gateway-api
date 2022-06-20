#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const helper = require('../tests/helper.js');
const yargs = require('yargs');
let argv = yargs
  .usage('Run baseStateGenerator using a given Gateway environment')
  .help('h')
  .alias('h', 'help')
  .demandOption('c')
  .describe('c', 'Configuration file with gateway parameters')
  .string('c')
  .alias('c', 'gateway')
  .argv;

// TODO: pass this in a command line argument (if we find how to do it in package.json)
// or read it from the env config file
const WAIT_TIME_IN_MINUTES = 2;
const accounts = helper.ACCOUNTS;
const validRelayer = accounts.relayer;
const validUser = accounts.user;
const validOtherUser = accounts.otherUser;
process.env.AVN_SURI = accounts.user.seed;

const dummyT1Authority = '0xd6ae8250b8348c94847280928c79fb3b63ca453e';
const royalties = [
  {
    recipient_t1_address: '0xf8f77379A1C6b5CA66702b5943c5b229E310Ec03',
    rate: {
      parts_per_million: 10000
    }
  }
];

(async () => {
  const api = await helper.avnApi();

  //AVN_SURI env variable updated so we can mint nfts owned by this account
  process.env.AVN_SURI = validUser.seed;

  //Mint nft owned by user
  let externalRef = 'avn-gateway-test-user-unlisted-' + new Date().toISOString();
  let requestId = await api.send.mintSingleNft(validRelayer.address, externalRef, royalties, dummyT1Authority);
  console.log('Waiting for mintSingleNFT', externalRef);
  await helper.confirmStatus(api, requestId, 'Processed', WAIT_TIME_IN_MINUTES);
  const unlistedUserNftId = await api.query.getNftId(externalRef);

  //Mint and list nft owned by user
  externalRef = 'avn-gateway-test-user-listed-' + new Date().toISOString();
  requestId = await api.send.mintSingleNft(validRelayer.address, externalRef, royalties, dummyT1Authority);
  console.log('Waiting for mintSingleNFT', externalRef);
  await helper.confirmStatus(api, requestId, 'Processed', WAIT_TIME_IN_MINUTES);
  const listedUserNftId = await api.query.getNftId(externalRef);
  requestId = await api.send.listFiatNftForSale(validRelayer.address, listedUserNftId);
  console.log('Waiting for listing for sale', listedUserNftId);
  await helper.confirmStatus(api, requestId, 'Processed', WAIT_TIME_IN_MINUTES);

  process.env.AVN_SURI = validOtherUser.seed;

  //Mint nft owned by user
  externalRef = 'avn-gateway-test-user-unlisted-' + new Date().toISOString();
  requestId = await api.send.mintSingleNft(validRelayer.address, externalRef, royalties, dummyT1Authority);
  console.log('Waiting for mintSingleNFT', externalRef);
  await helper.confirmStatus(api, requestId, 'Processed', WAIT_TIME_IN_MINUTES);
  const unlistedOtherUserNftId = await api.query.getNftId(externalRef);

  //Mint and list nft owned by user
  externalRef = 'avn-gateway-test-user-listed-' + new Date().toISOString();
  requestId = await api.send.mintSingleNft(validRelayer.address, externalRef, royalties, dummyT1Authority);
  console.log('Waiting for mintSingleNFT', externalRef);
  await helper.confirmStatus(api, requestId, 'Processed', WAIT_TIME_IN_MINUTES);
  const listedOtherUserNftId = await api.query.getNftId(externalRef);
  requestId = await api.send.listFiatNftForSale(validRelayer.address, listedOtherUserNftId);
  console.log('Waiting for listing for sale', listedOtherUserNftId);
  await helper.confirmStatus(api, requestId, 'Processed', WAIT_TIME_IN_MINUTES);

  console.log('Waiting done');

  const mintedNfts = {
    user: {
      owner_address: validUser.address,
      listedNft: listedUserNftId,
      unlistedNft: unlistedUserNftId
    },
    otherUser: {
      owner_address: validOtherUser.address,
      listedNft: listedOtherUserNftId,
      unlistedNft: unlistedOtherUserNftId
    }
  };

  let gatewayFile = argv.gateway;
  const configPath = gatewayFile ? `../config/environments/${gatewayFile}.json` : '../config/environments/sandbox.json';
  const resolvedPath = path.resolve(__dirname, configPath);

  const jsonString = fs.readFileSync(resolvedPath);
  const gatewayConfig = JSON.parse(jsonString);

  gatewayConfig['nfts'] = mintedNfts;
  const data = JSON.stringify(gatewayConfig, null, 2);
  fs.writeFileSync(resolvedPath, data);
})();
