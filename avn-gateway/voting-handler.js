const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const utils = require('/opt/utils.js');

const AVN_CONNECTOR_ENDPOINT = process.env.AVN_CONNECTOR_ENDPOINT;
const AVN_VOTES_BUCKET = 'avn-votes';

exports.handler = async event => {
  await utils.init();
  const method = event.requestContext.http.method;
  let response;

  if (method === 'GET') {
    const proposal = event.queryStringParameters ? event.queryStringParameters.proposal : null;
    response = proposal ? await getFormattedProposal(proposal) : await getFormattedProposalList();
  } else if (method === 'POST') {
    response = await checkVoteAndUpdateProposal(event.body);
  }

  return {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true,
    },
    body: JSON.stringify(response)
  };
};

async function getFormattedProposal(proposal) {
  let result = {};

  try {
    proposal = proposal + '.json';
    const proposalData = await getProposalData(proposal);
    result = formatProposalData(proposal, proposalData);
  } catch (err) {
    console.log(err);
  }

  return result;
}

async function getFormattedProposalList() {
  let results = [];

  try {
    const proposals = await listProposals();
    for await(const proposal of proposals) {
      const proposalData = await getProposalData(proposal);
      results.push(formatProposalData(proposal, proposalData));
    }
  } catch (err) {
    console.log(err);
  }

  return results;
}

async function checkVoteAndUpdateProposal(requestData) {
  let voterIntention, proposal, proposalData;

  try {
    voterIntention = JSON.parse(requestData);
    proposal = voterIntention.proposal + '.json';
    proposalData = await getProposalData(proposal);
  } catch (err) {
    console.log(err);
    return { result: 'bad request' };
  }

  if (voteIsOpen(proposalData) === false) {
    return { result: 'vote not open' };
  } else if (voterIntention.address in proposalData.votes) {
    return { result: 'has already voted' };
  } else if (utils.verifyVotingSignature(voterIntention) === false) {
    return { result: 'invalid signature' };
  } else {
    return { result: await weightVoteAndUpdateProposal(proposal, voterIntention, proposalData) };
  }
}

async function weightVoteAndUpdateProposal(proposal, voterIntention, proposalData) {
  const weightedVote = await weightVote(voterIntention, proposalData);
  if (weightedVote === null) {
    return 'failed to vote';
  } else if (weightedVote === 0) {
    return 'zero balance at voting block';
  } else {
    proposalData.votes[voterIntention.address] = weightedVote;
    await updateProposalData(proposal, proposalData);
    return 'success';
  }
}

async function getProposalData(proposal) {
  let proposalData = {};

  try {
    const s3Params = { Bucket: AVN_VOTES_BUCKET, Key: proposal };
    const data = await s3.getObject(s3Params).promise();
    proposalData = JSON.parse(data.Body.toString());
  } catch (err) {
    console.log(err);
  }

  return proposalData;
}

async function listProposals() {
  let proposalList = [];

  try {
    const s3Params = { Bucket: AVN_VOTES_BUCKET };
    proposalList = (await s3.listObjectsV2(s3Params).promise()).Contents.map(c => c.Key);
  } catch (err) {
    console.log(err);
  }

  return proposalList;
}

async function updateProposalData(proposal, proposalData) {
  try {
    const s3Params = { Bucket: AVN_VOTES_BUCKET, Key: proposal, Body: JSON.stringify(proposalData) };
    await s3.putObject(s3Params).promise();
  } catch (err) {
    console.log(err);
  }
}

function voteIsOpen(proposalData) {
  const now = Math.floor(new Date().getTime() / 1000);
  return now > proposalData.start && now < proposalData.end;
}

async function weightVote(voterIntention, proposalData) {
  try {
    const params = ['at', proposalData.blockNumber, voterIntention.address];
    const query = { palletName: 'system', storageName: 'account', params: params };
    const avnResponse = await utils.axios.post(AVN_CONNECTOR_ENDPOINT + 'avnQuery', query);
    const voterBalanceAtBlock = utils.toWholeAVT(avnResponse.data.data.free);
    const voterStakedBalanceAtBlock = utils.toWholeAVT(avnResponse.data.data.feeFrozen);
    const voterUnstakedBalanceAtBlock = voterBalanceAtBlock - voterStakedBalanceAtBlock;
    const voterWeightedBalanceAtBlock = voterStakedBalanceAtBlock * 2 + voterUnstakedBalanceAtBlock;
    return voterIntention.vote ? voterWeightedBalanceAtBlock : voterWeightedBalanceAtBlock * -1;
  } catch (err) {
    console.error(err);
    return null;
  }
}

function formatProposalData(proposal, proposalData) {
  const proposalId = proposal.split('.')[0];
  return {
    title: proposalData.title,
    description: proposalData.description,
    author: proposalData.author,
    startDate: formatAsDate(proposalData.start),
    endDate: formatAsDate(proposalData.end),
    referenceID: proposalId,
    status: voteIsOpen(proposalData) ? 'Active' : 'Closed',
    hash: proposalData.blockNumber,
    voters: formatVotes(proposalData.votes),
    id: proposalId
  }
}

function formatAsDate(timestamp) {
  const date = new Date(timestamp * 1000);
  return [date.getDate(), (date.getMonth()+1), date.getFullYear()].join('-');
}

function formatVotes(votes) {
  let result = [];
  let voterId = 0;

  for (const [address, weight] of Object.entries(votes)) {
    const formattedVote = {
      address: address,
      voteSway: weight > 0 ? 'approve' : 'disapprove',
      staker: true,
      avt_weight: weight > 0 ? weight : weight * -1,
      id: voterId++
    };
    result.push(formattedVote);
  }

  return result;
}