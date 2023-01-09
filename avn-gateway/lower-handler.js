const utils = require('/opt/utils.js');
const AVN_CONNECTOR_ENDPOINT = process.env.AVN_CONNECTOR_ENDPOINT;

exports.handler = async event => {
  return {
    statusCode: 200,
    headers: { 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify(await getLowers(event.queryStringParameters))
  };
};

async function getLowers(qsParam) {
  const result = { lowerData: [], status: 'success' };
  console.log("Processing lowers from account: ", qsParam.account);

  try {
    const response = await utils.axios.post(AVN_CONNECTOR_ENDPOINT + 'lowers', { account: qsParam.account });
    result.lowerData = response.data;
  } catch (err) {
    console.log(err);
    result.status = 'error';
  }

  return result;
}
