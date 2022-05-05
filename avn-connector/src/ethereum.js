const axios = require('axios');
const config = require('multiconfig').load();
const ETHERSCAN_URL = config.etherscan.etherscan_url;
const ETHERSCAN_KEY = config.etherscan.etherscan_api_key;
const LIFT_EVENT_SIGNATURE = '0x8964776336bc2fa8ecaaf70b6f8e8450807efb1ff78f8b87980707aa821f0ec0';
const MAX_LIFT_AGE = 60 * 60 * 24 * 5; // 5 days
const REQUIRED_CONFIRMATIONS = 20;

async function transactionExists(ethTxHash) {
  let response = await axios.get(
    `${ETHERSCAN_URL}module=transaction&action=gettxreceiptstatus&txhash=${ethTxHash}&apikey=${ETHERSCAN_KEY}`
  );
  check(response);
  return response.data.result.status === '1';
}

async function getLiftEvents(avnContract, fromBlock) {
  fromBlock = (!fromBlock) ? await getBlocknumber(MAX_LIFT_AGE, 0) : fromBlock;
  let toBlock = await getBlocknumber(0, REQUIRED_CONFIRMATIONS);

  let response = await axios.get(
    `${ETHERSCAN_URL}module=logs&action=getLogs&fromBlock=${fromBlock}&toBlock=${toBlock}&address=${avnContract}&topic0=${LIFT_EVENT_SIGNATURE}&apikey=${ETHERSCAN_KEY}`
  );
  check(response);
  const txList = response.data.result;
  return { liftEvents: txList.map(tx => [LIFT_EVENT_SIGNATURE, tx.transactionHash]), toBlock: toBlock + 1 };
}

async function getBlocknumber(timeOffset, blockOffset) {
  const timeNow = Math.floor(Date.now() / 1000);
  const timestamp = timeNow - timeOffset;
  let response = await axios.get(
    `${ETHERSCAN_URL}module=block&action=getblocknobytime&timestamp=${timestamp}&closest=before&apikey=${ETHERSCAN_KEY}`
  );
  check(response);
  return parseInt(response.data.result) - blockOffset;
}

function check(response) {
  if (response.data.status === '0') {
    throw new Error(`ETHERSCAN ERROR: ${response}`);
  }
}

module.exports = {
  getLiftEvents,
  transactionExists
};
