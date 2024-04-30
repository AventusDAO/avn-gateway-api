import * as utils from '/opt/utils.js';
import { Handler, APIGatewayProxyEvent } from 'aws-lambda';

const AVN_CONNECTOR_ENDPOINT = process.env.AVN_CONNECTOR_ENDPOINT!;

enum StatusCode {
  OK = 200,
  MultiStatus = 207,
  InternalServerError = 500
}

enum LowerStatus {
  Success = 'success',
  Error = 'error'
}

export interface LowerResult {
  statusCode: StatusCode,
  headers: {
    [name: string]: string
  },
  body: string,
}

export interface QueryStringParam {
  account?: string
}

export interface Lower {
  lowerData: [],
  status: LowerStatus,
}

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
