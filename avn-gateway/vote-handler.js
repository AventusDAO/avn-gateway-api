const {S3Client} = require('@aws-sdk/client-s3');
const s3 = new S3Client();
const utils = require('/opt/utils.js');

const AVN_CONNECTOR_ENDPOINT = process.env.AVN_CONNECTOR_ENDPOINT;
const AVN_VOTES_BUCKET = process.env.AVN_VOTES_BUCKET;

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
    headers: { 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify(response)
  };
};

async function getFormattedProposal(proposal) {
  let result = {};

  try {
    const proposalData = await getProposalData(proposal);
    result = formatProposalData(proposal, proposalData);
    result.votes = proposalData.votes ? formatVotes(proposalData.votes, proposalData.votingChoice) : [];
  } catch (err) {
    console.log(err);
  }

  return result;
}

async function getFormattedProposalList() {
  let results = [];

  try {
    const proposals = await listProposals();
    for await (const proposal of proposals) {
      const proposalData = await getProposalData(proposal);
      results.push(formatProposalData(proposal, proposalData));
    }
  } catch (err) {
    console.log(err);
  }

  return results;
}

async function checkVoteAndUpdateProposal(requestData) {
  let voterIntention, proposalData;

  try {
    voterIntention = JSON.parse(requestData);
    voterIntention.publicKey = utils.convertToPublicKey(voterIntention.address);
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
  } else if (verifyVotingSignature(voterIntention) === false) {
    return { result: 'invalid signature provided' };
  } else {
    return { result: await weightVoteAndUpdateProposal(voterIntention, proposalData) };
  }
}

async function changeVoteAndUpdateProposal(voterIntention, proposalData) {
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

function verifyVotingSignature(votingIntention) {
  const message = utils.stringToHex('<Bytes>' + votingIntention.proposal + votingIntention.vote + '</Bytes>');
  return utils.signatureVerify(message, votingIntention.signature, votingIntention.publicKey).isValid;
}

async function weightVoteAndUpdateProposal(voterIntention, proposalData) {
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

async function getProposalData(proposal) {
  let proposalData = {};

  try {
    const s3Params = { Bucket: AVN_VOTES_BUCKET, Key: proposal + '.json' };
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
    proposalList = (await s3.listObjectsV2(s3Params).promise()).Contents.map(c => c.Key.split('.')[0]);
  } catch (err) {
    console.log(err);
  }

  return proposalList;
}

async function updateProposalData(proposal, proposalData) {
  try {
    const s3Params = { Bucket: AVN_VOTES_BUCKET, Key: proposal + '.json', Body: JSON.stringify(proposalData) };
    await s3.putObject(s3Params).promise();
  } catch (err) {
    console.log(err);
  }
}

function voteStatus(proposalData) {
  const now = Math.floor(new Date().getTime() / 1000);

  if (now > proposalData.start && now < proposalData.end) {
    return 'Active';
  } else if (now < proposalData.start) {
    return 'Pending';
  } else {
    return 'Closed';
  }
}

async function weightVote(voterIntention, proposalData) {
  try {
    const params = ['at', proposalData.blockNumber, voterIntention.publicKey];
    const query = { palletName: 'system', storageName: 'account', params: params };
    const avnResponse = await utils.axios.post(AVN_CONNECTOR_ENDPOINT + 'avnQuery', query);
    // TODO - use metadata calls to calculate the actual staked amount over relying on it simply not being free AVT
    const voterBalanceAtBlock = utils.toWholeAVT(avnResponse.data.data.free);
    const voterStakedBalanceAtBlock = utils.toWholeAVT(avnResponse.data.data.feeFrozen);
    const voterUnstakedBalanceAtBlock = voterBalanceAtBlock - voterStakedBalanceAtBlock;
    return voterStakedBalanceAtBlock * 2 + voterUnstakedBalanceAtBlock;
  } catch (err) {
    console.error(err);
    return null;
  }
}

function formatProposalData(proposal, proposalData) {
  return {
    title: proposalData.title,
    description: proposalData.description,
    start: proposalData.start * 1000,
    end: proposalData.end * 1000,
    proposal: proposal,
    status: voteStatus(proposalData),
    blockNumber: proposalData.blockNumber,
    numVotes: proposalData.votes ? Object.keys(proposalData.votes).length : 0,
    scores: proposalData.scores || [0, 0],
    votingChoice: proposalData.votingChoice || [0, 0]
  };
}

function formatVotes(votes, votingChoice) {
  let formattedVotes = [];

  for (const [publicKey, weight] of Object.entries(votes)) {
    formattedVotes.push({
      address: utils.convertToAddress(publicKey),
      voteSway: weight > 0 ? votingChoice[0] : votingChoice[1],
      avtWeight: Math.abs(weight)
    });
  }

  return formattedVotes;
}
