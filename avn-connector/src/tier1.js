const redis = require('./redis');
const config = require('multiconfig').load();
const { ethers } = require('ethers');
// const provider = new ethers.providers.JsonRpcProvider(config.tier1.tier1_provider_url);
const provider = new ethers.providers.JsonRpcProvider('https://goerli.infura.io/v3/3a485a8342a84b6db15949a84ab4f4c8');
const log4js = require('log4js');
const log = log4js.getLogger();

const ETH_AS_TOKEN = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
const MAX_LIFT_AGE_IN_BLOCKS = 60 * 60 * 24 * 5 / 12; // ~5 days @ 12 secs per block
const REQUIRED_CONFIRMATION_BLOCKS = 20;
const EVENT_SIGNATURE = {
  LIFT: ethers.utils.id('LogLifted(address,address,bytes32,uint256)'),
  LOWER: ethers.utils.id('LogLowered(address,address,bytes32,uint256)'),
  ROOT: ethers.utils.id('LogRootPublished(bytes32,uint256)')
}

async function getLockedBalance(avnContract, tokenAddress) {
  let balance = 0;

  try {
    if (tokenAddress.toLowerCase() === ETH_AS_TOKEN) {
      balance = await provider.getBalance(avnContract);
    } else {
      const abiSnippet = 'function balanceOf(address) view returns (uint256)';
      const tokenContract = new ethers.Contract(tokenAddress, abiSnippet, provider);
      balance = await tokenContract.balanceOf(avnContract);
    }
  } catch (error) {
    log.error('Error getting locked balance:', error);
  }

  return balance.toString();
}

async function getLiftEvents(avnContract) {
  let fromBlock = 0, toBlock = 0;
  const liftEvents = [];

  try {
    const currentBlock = provider.getBlocknumber();
    const fromBlock = (await redis.getCheckLiftsFromEthBlock()) || currentBlock - MAX_LIFT_AGE_IN_BLOCKS;
    const toBlock = currentBlock - REQUIRED_CONFIRMATION_BLOCKS;

    if (fromBlock <= toBlock) {
      const events = await provider.getLogs({ address: avnContract, topics: [EVENT_SIGNATURE.LIFT], fromBlock });
      events.forEach(event => liftEvents.push([EVENT_SIGNATURE.LIFT, event.transactionHash]));
    }
  } catch (error) {
    log.error('Error getting lift events:', error);
  }

  return { fromBlock, toBlock, liftEvents };
}

async function getLatestClaimedLowers(avnContract) {
  const claimedLowers = [];
  let fromBlock = 0;

  try {
    fromBlock = await redis.getCheckClaimedLowersFromAvnBlock();
    const events = await provider.getLogs({ address: avnContract, topics: [EVENT_SIGNATURE.LOWER], fromBlock });
    if (events.length > 0) fromBlock = events[events.length - 1].blockNumber + 1;

    for await (const txHash of events.map(event => event.transactionHash)) {
      const txData = await provider.getTransaction(txHash);
      const inputs = ethers.utils.defaultAbiCoder.decode(['bytes','bytes32[]'], ethers.utils.hexDataSlice(txData.data, 4));
      console.log("XXXXXX-   INPUTSSSS", inputs)
      claimedLowers.push(web3.utils.keccak256(inputs[1]));
    }
  } catch (error) {
    log.error('Error getting claimed lowers:', error);
  }

  return { claimedLowers, fromBlock };
}

async function getPublishedRoots(avnContract) {
  let events = [];

  try {
    events = await provider.getLogs({ address: avnContract, topics: [EVENT_SIGNATURE.ROOT], fromBlock: 0 });
  } catch (error) {
    log.error('Error getting published roots:', error);
  }

  return events.map(event => event.topics[1].toLowerCase()); // topic 1 = rootHash
}

module.exports = {
  getLatestClaimedLowers,
  getLiftEvents,
  getLockedBalance,
  getPublishedRoots
};
