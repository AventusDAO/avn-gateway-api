// @ts-ignore
import { S3Client, GetObjectCommand, ListObjectsV2Command, PutObjectCommand } from '@aws-sdk/client-s3';
// @ts-ignore
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { init, convertToPublicKey, stringToHex, signatureVerify, axios, toWholeAVT, convertToAddress } from '/opt/utils';
import { Readable } from 'stream';
import { VoterIntention, ProposalData, FormattedVote, FormattedProposal } from './types';

const AVN_CONNECTOR_ENDPOINT: string | undefined = process.env.AVN_CONNECTOR_ENDPOINT;
const AVN_VOTES_BUCKET: string | undefined = process.env.AVN_VOTES_BUCKET;

const s3 = new S3Client();

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  await init();
  const method = event.requestContext.httpMethod;
  let response;

  if (method === 'GET') {
    const proposal = event.queryStringParameters?.proposal || null;
    response = proposal ? await getFormattedProposal(proposal) : await getFormattedProposalList();
  } else if (method === 'POST') {
    response = await checkVoteAndUpdateProposal(event.body);
  }

  return {
    statusCode: 200,
    headers: { 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify(response)
  };
};

async function getFormattedProposal(proposal: string): Promise<FormattedProposal> {
  try {
      const proposalData = await getProposalData(proposal);
      return {
          title: proposalData.title,
          description: proposalData.description,
          start: proposalData.start * 1000,
          end: proposalData.end * 1000,
          proposal,
          status: voteStatus(proposalData),
          blockNumber: proposalData.blockNumber,
          numVotes: proposalData.votes ? Object.keys(proposalData.votes).length : 0,
          scores: proposalData.scores || [0, 0],
          votingChoice: proposalData.votingChoice || [0, 0],
          votes: proposalData.votes ? formatVotes(proposalData.votes, proposalData.votingChoice) : []
      };
  } catch (err) {
      console.error(err);
      return {} as FormattedProposal;
  }
}


async function getFormattedProposalList(): Promise<FormattedProposal[]> {
  try {
      const proposals = await listProposals();
      return Promise.all(proposals.map(async proposal => {
          const proposalData = await getProposalData(proposal);
          return formatProposalData(proposal, proposalData);
      }));
  } catch (err) {
      console.error(err);
      return [];
  }
}

async function checkVoteAndUpdateProposal(requestData: string): Promise<{result:string}> {
  let voterIntention: VoterIntention, proposalData: ProposalData;

  try {
    voterIntention = JSON.parse(requestData);
    voterIntention.publicKey = convertToPublicKey(voterIntention.address);
    proposalData = await getProposalData(voterIntention.proposal);
    if (proposalData.votes === undefined) {
      proposalData.votes = {};
      proposalData.scores = [0, 0];
    }
  } catch (err) {
    console.log(err);
    return { result: 'bad request' };
  }

  if (voteStatus(proposalData) !== 'Active') {
    return { result: 'vote is inactive' };
  } else if (voterIntention.publicKey in proposalData.votes) {
    return { result: await changeVoteAndUpdateProposal(voterIntention, proposalData) };
  } else if (!verifyVotingSignature(voterIntention)) {
    return { result: 'invalid signature provided' };
  } else {
    return { result: await weightVoteAndUpdateProposal(voterIntention, proposalData) };
  }
}

async function changeVoteAndUpdateProposal(voterIntention: VoterIntention, proposalData: ProposalData): Promise<string> {
  const weightedVote = proposalData.votes[voterIntention.publicKey];
  const existingVote = weightedVote > 0;
  const newVote = voterIntention.vote;

  if (newVote !== existingVote) {
    proposalData.scores[0] -= weightedVote;
    proposalData.scores[1] += weightedVote;
    proposalData.votes[voterIntention.publicKey] = weightedVote * -1;
    await updateProposalData(voterIntention.proposal, proposalData);
  }

  return 'success';
}

function verifyVotingSignature(votingIntention: VoterIntention): boolean {
  const message = stringToHex('<Bytes>' + votingIntention.proposal + votingIntention.vote + '</Bytes>');
  return signatureVerify(message, votingIntention.signature, votingIntention.publicKey).isValid;
}

async function weightVoteAndUpdateProposal(voterIntention: VoterIntention, proposalData: ProposalData): Promise<string> {
  const weightedVote = await weightVote(voterIntention, proposalData);
  if (weightedVote === null) {
    return 'failed to vote';
  } else if (weightedVote === 0) {
    return 'account has zero AVT at voting block';
  } else {
    proposalData.votes[voterIntention.publicKey] = weightedVote;

    if (voterIntention.vote) {
      proposalData.scores[0] += weightedVote;
      proposalData.votes[voterIntention.publicKey] = weightedVote;
    } else {
      proposalData.scores[1] += weightedVote;
      proposalData.votes[voterIntention.publicKey] = weightedVote * -1;
    }

    await updateProposalData(voterIntention.proposal, proposalData);
    return 'success';
  }
}

async function getProposalData(proposal: string): Promise<ProposalData> {
  let proposalData: ProposalData = { title: '', description: '', start: 0, end: 0, blockNumber: 0, scores: [0, 0], votingChoice: [0, 0] };

  try {
    const s3Params = { Bucket: AVN_VOTES_BUCKET!, Key: proposal + '.json' };
    const data = await s3.send(new GetObjectCommand(s3Params));
    const bodyStream = Readable.from(data.Body);
    const bodyData = (await bodyStream.toArray()).map(chunk => chunk.toString()).join('');
    proposalData = JSON.parse(bodyData);
  } catch (err) {
    console.log(err);
  }

  return proposalData;
}

async function listProposals(): Promise<string[]> {
  let proposalList: string[] = [];

  try {
    const s3Params = { Bucket: AVN_VOTES_BUCKET! };
    const data = await s3.send(new ListObjectsV2Command(s3Params));
    proposalList = data.Contents.map(c => c.Key.split('.')[0]);
  } catch (err) {
    console.log(err);
  }

  return proposalList;
}

async function updateProposalData(proposal: string, proposalData: ProposalData): Promise<void> {
  try {
    const s3Params = { Bucket: AVN_VOTES_BUCKET!, Key: proposal + '.json', Body: JSON.stringify(proposalData) };
    await s3.send(new PutObjectCommand(s3Params));
  } catch (err) {
    console.log(err);
  }
}


function voteStatus(proposalData: ProposalData): string {
  const now = Math.floor(new Date().getTime() / 1000);
  if (now > proposalData.start && now < proposalData.end) {
    return 'Active';
  } else if (now < proposalData.start) {
    return 'Pending';
  } else {
    return 'Closed';
  }
}

async function weightVote(voterIntention: VoterIntention, proposalData: ProposalData): Promise<number | null> {
  try {
      const params = ['at', proposalData.blockNumber, voterIntention.publicKey];
      const query = { palletName: 'system', storageName: 'account', params: params };
      const avnResponse = await axios.post(AVN_CONNECTOR_ENDPOINT + 'avnQuery', query);
      const voterBalanceAtBlock = toWholeAVT(avnResponse.data.data.free);
      const voterStakedBalanceAtBlock = toWholeAVT(avnResponse.data.data.frozen);
      const voterUnstakedBalanceAtBlock = voterBalanceAtBlock - voterStakedBalanceAtBlock;
      return voterStakedBalanceAtBlock + voterUnstakedBalanceAtBlock;
  } catch (err) {
      console.error(err);
      return null;
  }
}

function formatProposalData(proposal: string, proposalData: ProposalData): FormattedProposal {
  return {
      title: proposalData.title,
      description: proposalData.description,
      start: proposalData.start * 1000,
      end: proposalData.end * 1000,
      proposal,
      status: voteStatus(proposalData),
      blockNumber: proposalData.blockNumber,
      numVotes: proposalData.votes ? Object.keys(proposalData.votes).length : 0,
      scores: proposalData.scores || [0, 0],
      votingChoice: proposalData.votingChoice || [0, 0]
  };
}

function formatVotes(votes: Record<string, number>, votingChoice: number[]): FormattedVote[] {
  let formattedVotes: FormattedVote[] = [];
  for (const [publicKey, weight] of Object.entries(votes)) {
      formattedVotes.push({
          address: convertToAddress(publicKey),
          voteSway: weight > 0 ? votingChoice[0] : votingChoice[1],
          avtWeight: Math.abs(weight)
      });
  }
  return formattedVotes;
}