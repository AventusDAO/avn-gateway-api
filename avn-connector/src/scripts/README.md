To run the `addRelayer` script:
 - SSH to the `vault-init` EC2 instance in the sandbox account (Ireland). If you need access, speak to someone in the team to whitelist your public key
 - cd to `vaultTestData`
 - If you have a seed already, run:
 ```
node scripts/addRelayer.js setRelayer -u <User name or SS58 address> -s <seed in hex format>

 ```
 - If you want to generate a new relayer key pair, run:
 ```
node scripts/addRelayer.js generateRelayer -u <User name or SS58 address>

 ```