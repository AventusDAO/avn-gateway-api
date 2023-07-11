const redis = require('./redis');
const config = require('multiconfig').load();
const { ethers } = require('ethers');
const provider = new ethers.providers.JsonRpcProvider(config.tier1.tier1_provider_url);
const log4js = require('log4js');
const log = log4js.getLogger();

const EVM_TOKEN = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
const MAX_LIFT_AGE_IN_BLOCKS = 60 * 60 * 24 * 5 / 12; // ~5 days @ ~12 secs per block
const REQUIRED_CONFIRMATION_BLOCKS = 20;

const EVENT_SIG = {
  LIFT: ethers.utils.id('LogLifted(address,address,bytes32,uint256)'),
  LOWER: ethers.utils.id('LogLowered(address,address,bytes32,uint256)'),
  ROOT: ethers.utils.id('LogRootPublished(bytes32,uint256)')
}

async function getLockedBalance(address, token) {
  const request =
    token.toLowerCase() === ETH_AS_TOKEN
      ? `account&action=balance&address=${address}&tag=latest`
      : `account&action=tokenbalance&contractaddress=${token}&address=${address}&tag=latest`;
  return await callEtherscan(request);
}

async function getLiftEvents(avnContract) {
  let fromBlock = (await redis.getLiftsFromTier1Block()) || (await getBlocknumber(MAX_LIFT_AGE, 0));
  let toBlock = await getBlocknumber(0, REQUIRED_CONFIRMATIONS);
  toBlock = fromBlock > toBlock ? fromBlock : toBlock;

  const request = `logs&action=getLogs&fromBlock=${fromBlock}&toBlock=${toBlock}&address=${avnContract}&topic0=${LIFT_EVENT_SIGNATURE}`;
  let result = await callEtherscan(request);

  if (Array.isArray(result) === false) {
    throw new Error(`ETHERSCAN ERROR GETTING LIFTS: ${result}`);
  }

  const liftEvents = result.map(tx => [LIFT_EVENT_SIGNATURE, tx.transactionHash]);
  return { fromBlock, toBlock, liftEvents };
}

async function getLatestClaimedLowers(avnContract) {
  let fromBlock = await redis.getClaimedLowersFromTier1Block();
  const claimedLowers = [];

  try {
    const abi = [
      {
        name: 'LogLowered',
        type: 'event',
        inputs: [
          { indexed: true, type: 'address' },
          { indexed: true, type: 'address' },
          { indexed: true, type: 'bytes32' },
          { indexed: false, type: 'uint256' }
        ]
      }
    ];
    const contract = new web3.eth.Contract(abi, avnContract);
    const events = await contract.getPastEvents('LogLowered', { fromBlock });
    if (events.length > 0) fromBlock = events[events.length - 1].blockNumber + 1;
    const transactions = events.map(e => e.transactionHash);

    for (let i = 0; i < transactions.length; i++) {
      const txData = await web3.eth.getTransaction(transactions[i]);
      const params = web3.eth.abi.decodeParameters(
        [
          { type: 'bytes', name: 'leafHash' },
          { type: 'bytes32[]', name: 'merklePath' }
        ],
        '0x' + txData.input.slice(10)
      );
      claimedLowers.push(web3.utils.sha3(params.leafHash));
    }
  } catch (e) {
    console.error(`💔 Error getting claimed lowers from Ethereum: `, e);
  }

  return { claimedLowers, fromBlock };
}

async function getPublishedRoots(avnContract) {
  const abi = [
    {
      name: 'LogRootPublished',
      type: 'event',
      inputs: [
        { indexed: true, name: 'rootHash', type: 'bytes32' },
        { indexed: true, name: 't2TransactionId', type: 'uint256' }
      ]
    }
  ];
  const contract = new web3.eth.Contract(abi, avnContract);
  const events = await contract.getPastEvents('LogRootPublished', { fromBlock: 0 });
  return events.map(log => log.returnValues.rootHash.toLowerCase());
}

module.exports = {
  getLatestClaimedLowers,
  getLiftEvents,
  getLockedBalance,
  getPublishedRoots
};
