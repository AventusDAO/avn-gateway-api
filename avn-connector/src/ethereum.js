const axios = require('axios');
const redis = require('./redis');
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
  return response.data.result.status === '1';
}

async function getLiftEvents(avnContract) {
  let fromBlock = await redis.getCheckLiftsFromBlock() || await getBlocknumber(MAX_LIFT_AGE, 0);
  let toBlock = await getBlocknumber(0, REQUIRED_CONFIRMATIONS);
  if (fromBlock > toBlock) return [];

  let response = await axios.get(
    `${ETHERSCAN_URL}module=logs&action=getLogs&fromBlock=${fromBlock}&toBlock=${toBlock}&address=${avnContract}&topic0=${LIFT_EVENT_SIGNATURE}&apikey=${ETHERSCAN_KEY}`
  );

  if (Array.isArray(response.data.result) === false) {
    throw new Error(`ETHERSCAN ERROR GETTING LIFTS: ${response}`);
  }

  const liftEvents = response.data.result.map(tx => [LIFT_EVENT_SIGNATURE, tx.transactionHash]);
  return { fromBlock, toBlock, liftEvents };
}

async function getBlocknumber(timeOffset, blockOffset) {
  const timeNow = Math.floor(Date.now() / 1000);
  const timestamp = timeNow - timeOffset;
  let response = await axios.get(
    `${ETHERSCAN_URL}module=block&action=getblocknobytime&timestamp=${timestamp}&closest=before&apikey=${ETHERSCAN_KEY}`
  );
  return parseInt(response.data.result) - blockOffset;
}

module.exports = {
  getLiftEvents,
  transactionExists
};
