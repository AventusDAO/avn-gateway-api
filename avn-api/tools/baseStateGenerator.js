#!/usr/bin/env node

const fs = require('fs');
const helper = require('../tests/helper.js');
const yargs = require('yargs');
let argv = yargs
  .usage('Run baseStateGenerator using a given Gateway environment')
  .help('h')
  .alias('h', 'help')
  .demandOption('c')
  .describe('c', 'Configuration file with gateway parameters')
  .string('c')
  .alias('c', 'gateway').argv;

const accounts = helper.ACCOUNTS;
const validRelayer = accounts.relayer;
const validSender = accounts.sender;
const validUser = accounts.user1;

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

  //SURI env variable updated so we can mint nfts owned by this account
  process.env.SURI = validSender.seed;

  //Mint nft owned by sender
  let externalRef = 'avn-gateway-test-sender-unlisted-' + new Date().toISOString();
  let requestId = await api.send.mintSingleNft(validRelayer.address, externalRef, royalties, dummyT1Authority);
  await helper.confirmStatus(api, requestId, 'Processed');
  const unlistedSenderNftId = await api.query.getNftId(externalRef);

  //Mint and list nft owned by sender
  externalRef = 'avn-gateway-test-sender-listed-' + new Date().toISOString();
  requestId = await api.send.mintSingleNft(validRelayer.address, externalRef, royalties, dummyT1Authority);
  await helper.confirmStatus(api, requestId, 'Processed');
  const listedSenderNftId = await api.query.getNftId(externalRef);
  requestId = await api.send.listFiatNftForSale(validRelayer.address, listedSenderNftId);
  await helper.confirmStatus(api, requestId, 'Processed');

  process.env.SURI = validUser.seed;

  //Mint nft owned by user
  externalRef = 'avn-gateway-test-user-unlisted-' + new Date().toISOString();
  requestId = await api.send.mintSingleNft(validRelayer.address, externalRef, royalties, dummyT1Authority);
  await helper.confirmStatus(api, requestId, 'Processed');
  const unlistedUserNftId = await api.query.getNftId(externalRef);

  //Mint and list nft owned by user
  externalRef = 'avn-gateway-test-user-listed-' + new Date().toISOString();
  requestId = await api.send.mintSingleNft(validRelayer.address, externalRef, royalties, dummyT1Authority);
  await helper.confirmStatus(api, requestId, 'Processed');
  const listedUserNftId = await api.query.getNftId(externalRef);
  requestId = await api.send.listFiatNftForSale(validRelayer.address, listedUserNftId);
  await helper.confirmStatus(api, requestId, 'Processed');

  const mintedNfts = {
    sender: {
      owner_address: validSender.address,
      listedNft: listedSenderNftId,
      unlistedNft: unlistedSenderNftId
    },
    user: {
      owner_address: validUser.address,
      listedNft: listedUserNftId,
      unlistedNft: unlistedUserNftId
    }
  };

  let gatewayFile = argv.gateway;
  const configPath = gatewayFile ? `avn-api/config/${gatewayFile}.json` : 'avn-api/config/sandbox.json';

  const jsonString = fs.readFileSync(configPath);
  const sandboxConfig = JSON.parse(jsonString);

  sandboxConfig['nfts'] = mintedNfts;
  const data = JSON.stringify(sandboxConfig, null, 2);
  fs.writeFileSync('avn-api/config/sandbox.json', data);
})();
