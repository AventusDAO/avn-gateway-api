const assert = require('chai').assert;
const AvnApi = require('../avn-api/index.js');
const { accounts } = require('../avn-api/config/accounts.json');
const yargs = require('yargs');
const BN = require('bn.js');

// This will execute the contents of `setSuri` immediately
// since we are not storing the result of the
// call to the `require` function in a const or variable
require('../avn-api/tests/setSuri.js');

let argv = yargs
  .usage('Run smoke tests using a given Gateway environment')
  .help('h')
  .alias('h', 'help')
  .demandOption('g')
  .describe('g', 'Configuration file with gateway parameters')
  .string('g')
  .alias('g', 'gateway').argv;
let gatewayFile = argv.gateway;

console.log(`Running smoke tests on gateway: [${gatewayFile}]`);

describe('AVN Gateway Smoke Tests', function () {
  let api, relayer, sender, recipient;

  before(async () => {
    const { gateway } = require(`../avn-api/config/${gatewayFile}.json`);
    api = new AvnApi(gateway);
    await api.init();

    relayer = accounts.relayer.address;
    sender = accounts.user.address;
    recipient = accounts.otherUser.address;
  });

  it('query account balance', async () => {
    const senderBalance = await api.query.getAvtBalance(sender);
    assert(senderBalance);
  });

  it('proxy AVT transfer and poll transaction state', async () => {
    const amount = new BN('1');
    const requestId = await api.send.transferAvt(relayer, recipient, amount);
    assert(requestId !== undefined, 'requestId is undefined');
    assert(requestId !== 'Invalid params', 'request contains invalid params');
    assert(
      ['Pending', 'Processed'].includes((await api.poll.requestState(requestId)).status),
      'transaction state is neither Pending nor Processed'
    );
  });
});
