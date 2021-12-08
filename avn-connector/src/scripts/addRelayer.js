'use strict'
const Vault = require('../vaultApp')
const config = require('multiconfig').load()
const yargs = require("yargs");

async function setRelayer(userName, seed) {
  const vault = new Vault(config.vault.vault_url, config.vault.app_role_id, config.vault.app_secret_id)
  const pk = await vault.setNewRelayer(userName, seed)
  console.log(`Relayer set. Public key: ${pk}`)
}

async function generateRelayer(userName) {
  const vault = new Vault(config.vault.vault_url, config.vault.app_role_id, config.vault.app_secret_id)
  const pk = await vault.createNewRelayer(userName)
  console.log(`Relayer generated. Public key: ${pk}`)
}

async function run() {
  let args = yargs
  .strict()
  .usage('Script to manage relayers')
  .help("h")
  .alias("h", "help")
  .command(
    ['setRelayer'],
    `Command to set a relayer in vault, using a seed`,
    {},
    async (argv) => {
      await setRelayer(argv.relayerName, argv.seed);
  })
  .command(
    ['generateRelayer'],
    `Command to generate a relayer in vault`,
    {},
    async (argv) => {
      await generateRelayer(argv.relayerName);
  })
  //
  .string("u")
  .alias("u", "relayerName")
  .demandOption("u")
  .describe("u", `The relayer name to assign for the relayer`)
  .wrap(110)
  .string("s")
  .alias("s", "seed")
  .describe("s", `The seed to set for a relayer`)
  .wrap(110)
  .argv;
}

run();
