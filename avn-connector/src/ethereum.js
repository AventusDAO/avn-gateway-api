const axios = require('axios');
const config = require('multiconfig').load();
const ETHERSCAN_URL = config.etherscan.etherscan_url;
const ETHERSCAN_KEY = config.etherscan.etherscan_api_key;

async function transactionExists(ethTxHash) {
  let response = await axios.get(
    `${ETHERSCAN_URL}module=transaction&action=gettxreceiptstatus&txhash=${ethTxHash}&apikey=${ETHERSCAN_KEY}`
  );
  return response.data.result.status === '1';
}

module.exports = {
  transactionExists
};
