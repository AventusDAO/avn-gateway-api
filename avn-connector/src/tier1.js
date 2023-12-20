const redis = require('./redis');
const config = require('multiconfig').load();
const { ethers } = require('ethers');
const provider = new ethers.providers.JsonRpcProvider(config.tier1.tier1_provider_url);
const log4js = require('log4js');
const log = log4js.getLogger();

const EVM_TOKEN = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
const MAX_LIFT_AGE_IN_BLOCKS = (60 * 60 * 24 * 5) / 12; // ~5 days @ ~12 secs per block
const REQUIRED_CONFIRMATION_BLOCKS = 20;

const EVENT_SIG = {
  LIFT: ethers.utils.id('LogLifted(address,address,bytes32,uint256)'),
  LOWER: ethers.utils.id('LogLowered(address,address,bytes32,uint256)'),
  CLAIM: ethers.utils.id('LogLowerClaimed(uint32)'),
  ROOT: ethers.utils.id('LogRootPublished(bytes32,uint256)')
};

async function getLockedBalance(avnContract, tokenAddress) {
  let balance = 0;

  try {
    if (tokenAddress.toLowerCase() === EVM_TOKEN) {
      balance = await provider.getBalance(avnContract);
    } else {
      const abi = ['function balanceOf(address) view returns (uint256)'];
      const tokenContract = new ethers.Contract(tokenAddress, abi, provider);
      balance = await tokenContract.balanceOf(avnContract);
    }
  } catch (error) {
    log.error('Error getting locked balance:', error);
  }

  return balance.toString();
}

async function getLiftEvents(avnContract) {
  let fromBlock = 0,
    toBlock = 0;
  const liftEvents = [];

  try {
    const currentBlock = await provider.getBlockNumber();
    fromBlock = (await redis.getLiftsFromTier1Block()) || currentBlock - MAX_LIFT_AGE_IN_BLOCKS;
    toBlock = currentBlock - REQUIRED_CONFIRMATION_BLOCKS;

    if (fromBlock <= toBlock) {
      const events = await provider.getLogs({ address: avnContract, topics: [EVENT_SIG.LIFT], fromBlock, toBlock });
      events.forEach(event => liftEvents.push([EVENT_SIG.LIFT, event.transactionHash]));
    }
  } catch (error) {
    log.error('Error getting lift events:', error);
  }

  return { fromBlock, toBlock, liftEvents };
}

async function getLatestClaimedLowers(avnContract) {
  const claimedLowers = [];

  try {
    const fromBlock = await redis.getClaimedLowersFromTier1Block();
    const events = await provider.getLogs({ address: avnContract, topics: [EVENT_SIG.LOWER], fromBlock });
    for await (const txHash of events.map(event => event.transactionHash)) {
      const txData = await provider.getTransaction(txHash);
      const inputs = ethers.utils.defaultAbiCoder.decode(['bytes', 'bytes32[]'], ethers.utils.hexDataSlice(txData.data, 4));
      claimedLowers.push(ethers.utils.keccak256(inputs[0]));
    }
    if (events.length > 0) await redis.setClaimedLowersFromTier1Block(events[events.length - 1].blockNumber + 1);
  } catch (error) {
    log.error('Error getting claimed lowers:', error);
  }

  return claimedLowers;
}

async function getLatestPublishedRoots(avnContract) {
  let events = [];

  try {
    const fromBlock = await redis.getPublishedRootsFromTier1Block();
    events = await provider.getLogs({ address: avnContract, topics: [EVENT_SIG.ROOT], fromBlock });
    if (events.length > 0) await redis.setPublishedRootsFromTier1Block(events[events.length - 1].blockNumber + 1);
  } catch (error) {
    log.error('Error getting published roots:', error);
  }

  return events.map(event => event.topics[1].toLowerCase()); // topic 1 = rootHash
}

async function getLowersClaimedSinceBlock(avnContract, blockToCheckFrom) {
  const claimedLowerIds = [];
  const lastBlockChecked = blockToCheckFrom;
  try {
    const claims = await provider.getLogs({ address: avnContract, topics: [EVENT_SIG.CLAIM], fromBlock: blockToCheckFrom });
    claims.forEach(claim => {
      const lowerId = parseInt(claim.topics[1]);
      lastBlockChecked = Math.max(lastBlockChecked, claim.blockNumber);
      claimedLowerIds.push(lowerId);
    });
  } catch (error) {
    log.error('Error getting claimed lowers:', error);
  }

  return [lastBlockChecked, claimedLowerIds];
}

module.exports = {
  getLatestClaimedLowers,
  getLiftEvents,
  getLockedBalance,
  getLatestPublishedRoots,
  getLowersClaimedSinceBlock
};
