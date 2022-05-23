const chai = require('chai');
const assert = chai.assert;
chai.use(require('chai-as-promised'));
const yargs = require('yargs');
let argv = yargs
  .usage('Run smoke tests using a given Gateway environment')
  .help('h')
  .alias('h', 'help')
  .demandOption('c')
  .describe('c', 'Configuration file with gateway parameters')
  .string('c')
  .alias('c', 'gateway').argv;

let gatewayFile = argv.gateway;
const accountsPath = gatewayFile ? `../config/accounts/${gatewayFile}.json` : '../config/accounts/sandbox.json';
const { accounts } = require(accountsPath);
process.env.AVN_SURI = accounts.user.seed;


describe('Setting SURI as user seed', async () => {

  it('SURI is correctly set', async () => {
    assert.equal(process.env.AVN_SURI, accounts.user.seed);
  });
});
