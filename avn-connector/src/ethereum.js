const axios = require('axios');
const config = require('multiconfig').load();
const ETHERSCAN_URL = config.etherscan.etherscanUrl;
const ETHERSCAN_KEY = config.etherscan.etherscanKey;

async function transactionExists(txHash) {
  let receipt = await axios.get(
    `${ETHERSCAN_URL}module=transaction&action=gettxreceiptstatus&txhash=${txHash}&&apikey=${ETHERSCAN_KEY}`
  );
  return receipt.data.result.status !== '1'
}

module.exports = {
  transactionExists
};
