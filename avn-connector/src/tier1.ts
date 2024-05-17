import { ethers } from 'ethers';
const config = require('multiconfig').load();
import logger from './logger';
import redis from './redis';

const MIN_LIFT_AMOUNT = toBn(config.tier1.minLiftAmount);
const provider = new ethers.providers.JsonRpcProvider(config.tier1.tier1_provider_url);
const NATIVE_T1_TOKEN_ONLY = config.tier1.nativeT1TokenOnly === 'true' || config.tier1.nativeT1TokenOnly === true;
const EVM_TOKEN = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
//(60 * 60 * 24 * 5) / 12; ~5 days @ ~12 secs per block
const MAX_LIFT_AGE_IN_BLOCKS = Number(config.tier1.maxLiftAgeInBlocks);
const REQUIRED_CONFIRMATION_BLOCKS = Number(config.tier1.requiredConfirmationBlocks);
const MAX_LIFT_BLOCKS_TO_PROCESS = Number(config.tier1.maxLiftBlocksToProcess);

const EVENT_SIG = {
  LIFT: ethers.utils.id('LogLifted(address,bytes32,uint256)'),
  LOWER: ethers.utils.id('LogLowered(address,address,bytes32,uint256)'),
  CLAIM: ethers.utils.id('LogLowerClaimed(uint32)'),
  ROOT: ethers.utils.id('LogRootPublished(bytes32,uint256)')
};

async function getLockedBalance(avnContract: string, tokenAddress: string): Promise<string> {
  let balance = toBn(0);

  try {
    if (tokenAddress.toLowerCase() === EVM_TOKEN) {
      balance = await provider.getBalance(avnContract);
    } else {
      const abi = ['function balanceOf(address) view returns (uint256)'];
      const tokenContract = new ethers.Contract(tokenAddress, abi, provider);
      balance = await tokenContract.balanceOf(avnContract);
    }
  } catch (error) {
    logger.error('Error getting locked balance:', error);
  }

  return balance.toString();
}

async function getLiftEvents(avnContract: string): Promise<{ fromBlock: number; toBlock: number; liftEvents: [string, string][] }> {
  let fromBlock = 0;
  let toBlock = 0;
  const liftEvents: [string, string][] = [];

  try {
    const currentBlock = await provider.getBlockNumber();
    fromBlock = (await redis.getLiftsFromTier1Block()) || currentBlock - MAX_LIFT_AGE_IN_BLOCKS;
    toBlock = Math.min(fromBlock + MAX_LIFT_BLOCKS_TO_PROCESS, currentBlock - REQUIRED_CONFIRMATION_BLOCKS);

    if (fromBlock <= toBlock) {
      const events = await provider.getLogs({ address: avnContract, topics: [EVENT_SIG.LIFT], fromBlock, toBlock });
      events.forEach(event => {
        const amount = ethers.utils.defaultAbiCoder.decode(['uint256'], event.data)[0];
        if (amount.gte(MIN_LIFT_AMOUNT)) {
          const token = ethers.utils.defaultAbiCoder.decode(['address'], event.topics[1]).toString().toLowerCase();
          if (!NATIVE_T1_TOKEN_ONLY || token === EVM_TOKEN.toLowerCase()) {
            liftEvents.push([EVENT_SIG.LIFT, event.transactionHash]);
          } else {
            logger.info(`Ignoring lift for token: ${token}, amount: ${amount.toString()}, block: ${event.blockNumber}`);
          }
        }
      });

      return { fromBlock, toBlock, liftEvents };
    }

    return { fromBlock, toBlock: fromBlock, liftEvents };
  } catch (error) {
    logger.error('Error getting lift events:', error);
    throw error;
  }
}

async function getLatestClaimedLowers(avnContract: string): Promise<string[]> {
  const claimedLowers: string[] = [];

  try {
    const fromBlock = await redis.getClaimedLowersFromTier1Block();
    const events = await provider.getLogs({ address: avnContract, topics: [EVENT_SIG.LOWER], fromBlock });
    for (const event of events) {
      const txData = await provider.getTransaction(event.transactionHash);
      const inputs = ethers.utils.defaultAbiCoder.decode(['bytes', 'bytes32[]'], ethers.utils.hexDataSlice(txData.data, 4));
      claimedLowers.push(ethers.utils.keccak256(inputs[0]));
    }
    if (events.length > 0) await redis.setClaimedLowersFromTier1Block(events[events.length - 1].blockNumber + 1);
  } catch (error) {
    logger.error('Error getting claimed lowers:', error);
  }

  return claimedLowers;
}

async function getLatestPublishedRoots(avnContract: string): Promise<string[]> {
  let events: ethers.providers.Log[] = [];

  try {
    const fromBlock = await redis.getPublishedRootsFromTier1Block();
    events = await provider.getLogs({ address: avnContract, topics: [EVENT_SIG.ROOT], fromBlock });
    if (events.length > 0) await redis.setPublishedRootsFromTier1Block(events[events.length - 1].blockNumber + 1);
  } catch (error) {
    logger.error('Error getting published roots:', error);
  }

  return events.map(event => event.topics[1].toLowerCase());
}

async function getLowersClaimedSinceBlock(avnContract: string, fromBlock: number): Promise<[number, number[]]> {
  const claimedLowerIds: number[] = [];

  try {
    const claims = await provider.getLogs({ address: avnContract, topics: [EVENT_SIG.CLAIM], fromBlock });
    claims.forEach(claim => {
      const lowerId = Number(claim.topics[1]);
      fromBlock = Math.max(fromBlock, claim.blockNumber);
      claimedLowerIds.push(lowerId);
    });
  } catch (error) {
    logger.error('Error getting claimed lowers:', error);
  }

  return [fromBlock, claimedLowerIds];
}

function connectToBridge(contract: string, abi: any, account: string): ethers.Contract {
  const signer = new ethers.Wallet(account, provider);
  return new ethers.Contract(contract, abi, signer);
}

function toBn(val: any): ethers.BigNumber {
  return ethers.BigNumber.from(val);
}

const tier1 = {
  getLatestClaimedLowers,
  getLiftEvents,
  getLockedBalance,
  getLatestPublishedRoots,
  getLowersClaimedSinceBlock,
  connectToBridge
};
export default tier1;