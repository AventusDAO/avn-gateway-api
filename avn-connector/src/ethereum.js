const axios = require('axios');
const redis = require('./redis');
const config = require('multiconfig').load();
const Web3 = require('web3');
const provider = new Web3.providers.HttpProvider(config.ethereum.infura_url);
const web3 = new Web3(provider);
const log4js = require('log4js');
const log = log4js.getLogger();

const ETHERSCAN_URL = config.ethereum.etherscan_url;
const ETHERSCAN_KEY = config.ethereum.etherscan_api_key;
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
  toBlock = (fromBlock > toBlock) ? fromBlock : toBlock;

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
  log.trace(`ETHERSCAN REQUEST - ${ETHERSCAN_URL}module=${request}`);
  let response = await axios.get(`${ETHERSCAN_URL}module=${request}&apikey=${ETHERSCAN_KEY}`);
  log.trace('ETHERSCAN RESPONSE -', response.data);
  return response.data.result;
}

async function getLatestClaimedLowers(avnContract) {
  let fromBlock = (await redis.getCheckClaimedLowersFromBlock()) || 0);
  const claimedLowers = [];

  try {
    const abi = [{name:'LogLowered',type:'event',inputs:[{indexed:true,type:'address'},{indexed:true,type:'address'},{indexed:true,type:'bytes32'},{indexed:false,type:'uint256'}]}];
    const contract = new web3.eth.Contract(abi, avnContract);
    const events = await contract.getPastEvents('LogLowered', { fromBlock });
    if (events.length > 0) fromBlock = events[events.length - 1].blockNumber + 1;
    const transactions = events.map(e => e.transactionHash);

    for (let i = 0; i < transactions.length; i++) {
      const txData = await web3.eth.getTransaction(transactions[i]);
      const params = web3.eth.abi.decodeParameters([{type:'bytes',name:'leafHash'},{type:'bytes32[]',name:'merklePath'}], '0x'+txData.input.slice(10));
      claimedLowers.push(web3.utils.sha3(params.leafHash));
    }

  } catch (e) {
    console.error(`💔 Error getting claimed lowers from Ethereum: `, e);
  }

  return { claimedLowers, fromBlock };
}

async function getPublishedRoots(avnContract) {
  const abi = [{name:'LogRootPublished',type:'event',inputs:[{indexed:true,name:'rootHash',type:'bytes32'},{indexed:true,name:'t2TransactionId',type:'uint256'}]}];
  const contract = new web3.eth.Contract(abi, avnContract);
  const events = await contract.getPastEvents('LogRootPublished', { fromBlock: 0 });
  return events.map(log => log.returnValues.rootHash.toLowerCase());
}

module.exports = {
  getLatestClaimedLowers,
  getLiftEvents,
  getLockedBalance,
  getPublishedRoots,
  transactionExists,
};
