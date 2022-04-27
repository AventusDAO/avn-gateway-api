const axios = require('axios');
const config = require('multiconfig').load();
const ETHERSCAN_URL = config.etherscan.etherscan_url;
const ETHERSCAN_KEY = config.etherscan.etherscan_api_key;

async function transactionExists(txHash) {
  console.log(  `${ETHERSCAN_URL}module=transaction&action=gettxreceiptstatus&txhash=${txHash}&apikey=${ETHERSCAN_KEY}`)
  let receipt = await axios.get(
    `${ETHERSCAN_URL}module=transaction&action=gettxreceiptstatus&txhash=${txHash}&apikey=${ETHERSCAN_KEY}`
  );
  return receipt.data.result.status === '1'
}

module.exports = {
  transactionExists
};
