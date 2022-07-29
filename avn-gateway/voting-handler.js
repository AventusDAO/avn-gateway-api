const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const utils = require('/opt/utils.js');

const AVN_CONNECTOR_ENDPOINT = process.env.AVN_CONNECTOR_ENDPOINT;

exports.handler = async event => {
  return {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true,
    },
    body: JSON.stringify(await processRequest(event.body))
  };
};

async function processRequest(request) {
  const voterIntention = JSON.parse(request);
  const s3Params = { Bucket: 'avn-votes', Key: voterIntention.proposal + '.json' };
  const votingData = await getVotingData(s3Params);
  const hasNotVotedBefore = voterIntention.address in votingData.votes === false;

  if (voteIsOpen(votingData) && hasNotVotedBefore && isValidVote(voterIntention)) {
    votingData.votes[voterIntention.address] = await weightVote(voterIntention, votingData);
    await setVotingData(s3Params, votingData);
  }

  return currentState(votingData);
}

function voteIsOpen(votingData) {
  const now = Math.floor(new Date().getTime() / 1000);
  return now > votingData.start && now < votingData.end;
}

function isValidVote(voterIntention) {
  return true; // TODO: fix signing in Dapp
  // return utils.verifyVotingSignature(voterIntention);
}

async function weightVote(voterIntention, votingData) {
  try {
    const params = ['at', votingData.blockHash, voterIntention.address];
    const query = { palletName: 'system', storageName: 'account', params: params };
    const avnResponse = await utils.axios.post(AVN_CONNECTOR_ENDPOINT + 'avnQuery', query);
    const voterBalanceAtBlockHash = utils.toWholeAVT(avnResponse.data.data.free);
    return voterIntention.vote ? voterBalanceAtBlockHash * 2 : voterBalanceAtBlockHash * -2;
  } catch (err) {
    console.error(err);
  }
}

async function getVotingData(s3Params) {
  try {
    const data = await s3.getObject(s3Params).promise();
    return JSON.parse(data.Body.toString());
  } catch (err) {
    console.log(err);
  }
}

async function setVotingData(s3Params, votingData) {
  try {
    s3Params.Body = JSON.stringify(votingData);
    await s3.putObject(s3Params).promise();
  } catch (err) {
    console.log(err);
  };
}

function currentState(votingData) {
  let votes = [];
  let tally = 0;

  for (const [voter, weight] of Object.entries(votingData.votes)) {
    tally += weight;
    const vote = recoverVote(weight);
    const weighting = weight > 0 ? weight : weight * -1;
    votes.push({ voter, vote, weighting });
  }

  const result = recoverVote(tally);
  return { votes, result };
}

function recoverVote(weight) {
  return weight > 0 ? 'Approve' : weight < 0 ? 'Disapprove' : 'Undecided';
}