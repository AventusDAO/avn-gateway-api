import * as utils from '/opt/utils.js';
// @ts-ignore
import { Handler, APIGatewayProxyEvent } from 'aws-lambda';
import { StatusCode, LowerStatus, LowerResult, Lower, QueryStringParam } from './types';

const AVN_CONNECTOR_ENDPOINT = process.env.AVN_CONNECTOR_ENDPOINT!;

export const handler: Handler = async (event: APIGatewayProxyEvent): Promise<LowerResult> => {
  return {
    statusCode: StatusCode.OK,
    headers: { 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify(await getLowers(event.queryStringParameters))
  };
};

async function getLowers(qsParam: QueryStringParam): Promise<Lower> {
  const result: Lower = { lowerData: [], status: LowerStatus.Success };
  console.log('Processing lowers from account: ', qsParam.account);

  try {
    const response = await utils.axios.post(AVN_CONNECTOR_ENDPOINT + 'lowers', { account: qsParam.account });
    result.lowerData = response.data;
  } catch (err) {
    console.log(err);
    result.status = LowerStatus.Error;
  }

  return result;
}
