const axios = require('axios');
const redis = require('./redis');
const config = require('multiconfig').load();
const ETHERSCAN_URL = config.etherscan.etherscan_url;
const ETHERSCAN_KEY = config.etherscan.etherscan_api_key;
const LIFT_EVENT_SIGNATURE = '0x8964776336bc2fa8ecaaf70b6f8e8450807efb1ff78f8b87980707aa821f0ec0';
const ETH_AS_TOKEN = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
const MAX_LIFT_AGE = 60 * 60 * 24 * 5; // 5 days
const REQUIRED_CONFIRMATIONS = 20;

async function transactionExists(ethTxHash) {
  const request = `transaction&action=gettxreceiptstatus&txhash=${ethTxHash}`;
  let result = await callEtherscan(request);
  return result.status === '1';
}

async function getLockedBalance(address, token) {
  const request =
    token.toLowerCase() === ETH_AS_TOKEN
      ? `account&action=balance&address=${address}&tag=latest`
      : `account&action=tokenbalance&contractaddress=${token}&address=${address}&tag=latest`;
  return await callEtherscan(request);
}

async function getLiftEvents(avnContract) {
  let fromBlock = (await redis.getCheckLiftsFromBlock()) || (await getBlocknumber(MAX_LIFT_AGE, 0));
  let toBlock = await getBlocknumber(0, REQUIRED_CONFIRMATIONS);
  const request = `logs&action=getLogs&fromBlock=${fromBlock}&toBlock=${toBlock}&address=${avnContract}&topic0=${LIFT_EVENT_SIGNATURE}`;
  let result = await callEtherscan(request);

  if (Array.isArray(result) === false) {
    throw new Error(`ETHERSCAN ERROR GETTING LIFTS: ${result}`);
  }

  const liftEvents = result.map(tx => [LIFT_EVENT_SIGNATURE, tx.transactionHash]);
  return { fromBlock, toBlock, liftEvents };
}

async function getBlocknumber(timeOffset, blockOffset) {
  const timeNow = Math.floor(Date.now() / 1000);
  const timestamp = timeNow - timeOffset;
  const request = `block&action=getblocknobytime&timestamp=${timestamp}&closest=before`;
  let result = await callEtherscan(request);
  return parseInt(result) - blockOffset;
}

async function callEtherscan(request) {
  console.log('ETHERSCAN REQUEST', ETHERSCAN_URL, request);
  let response = await axios.get(`${ETHERSCAN_URL}module=${request}&apikey=${ETHERSCAN_KEY}`);
  console.log('ETHERSCAN RESPONSE', response);
  return response.data.result;
}

module.exports = {
  getLiftEvents,
  getLockedBalance,
  transactionExists
};
