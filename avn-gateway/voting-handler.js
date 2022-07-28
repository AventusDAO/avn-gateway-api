const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const utils = require('/opt/utils.js');

const AVN_CONNECTOR_ENDPOINT = process.env.AVN_CONNECTOR_ENDPOINT;

exports.handler = async event => {
  return {
    statusCode: 200,
    body: JSON.stringify(await processRequest(event.body))
  };
};

async function processRequest(request) {
  const intention = JSON.parse(request);
  const s3Params = { Bucket: 'voting-test', Key: intention.proposal + '.json' };
  const votingData = await getVotingData(s3Params);
  const hasNotVoted = intention.address in votingData.votes === false;

  if (voteIsOpen(votingData) && hasNotVoted && isValidVote(intention)) {
    votingData.votes[intention.address] = await weightVote(intention, votingData);
    await setVotingData(s3Params, votingData);
  }

  return generateCurrentState(votingData);
}

function generateCurrentState(votingData) {
  let votes = [];
  let result = 0;

  for (const [address, weight] of Object.entries(votingData.votes)) {
    if (weight > 0) {
      votes.push({ voter: address, weight: weight, vote: 'Approve' });
    } else {
      votes.push({ voter: address, weight: weight * -1, vote: 'Disapprove' });
    }
    result += weight;
  }

  return result >= 0 ? { votes, result: 'Approve' } : { votes, result: 'Dispprove' };
}

function voteIsOpen(votingData) {
  const now = Math.floor(new Date().getTime() / 1000);
  return now > votingData.start && now < votingData.end;
}

function hasNotVoted(intention) {
  return (intention.address in votes) === false;
}

function isValidVote(intention) {
  return utils.verifyVotingSignature(intention);
  return true;
}

async function weightVote(intention, votingData) {
  try {
    const params = ['at', votingData.blockHash, intention.address];
    const query = { palletName: 'system', storageName: 'account', params: params };
    const avnResponse = await utils.axios.post(AVN_CONNECTOR_ENDPOINT + 'avnQuery', query);
    const voterBalanceAtBlockHash = utils.toWholeAVT(avnResponse.data.data.free);
    return intention.vote ? voterBalanceAtBlockHash * 2 : voterBalanceAtBlockHash * -2;
  } catch (err) {
    console.error(err);
  }
}

async function getVotingData(s3Params) {
  const data = await s3.getObject(s3Params).promise();
  return JSON.parse(data.Body.toString());
}

async function setVotingData(s3Params, votingData) {
  s3Params.Body = JSON.stringify(votingData);
  try {
    const data = await s3.putObject(s3Params).promise();
  } catch (err) {
    console.log(err);
  };
}