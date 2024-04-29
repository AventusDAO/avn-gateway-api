import * as utils from '/opt/utils.js';
import { Handler, APIGatewayProxyEvent } from 'aws-lambda';

const AVN_CONNECTOR_ENDPOINT = process.env.AVN_CONNECTOR_ENDPOINT!;

enum StatusCode {
  OK = 200,
  MultiStatus = 207,
  InternalServerError = 500
}

export interface Headers {
  'Access-Control-Allow-Origin': string
}

export interface ResponseFormat {
  statusCode: StatusCode,
  headers: Headers,
  body: string,
}

export interface QueryStringParam {
  account?: string
}

export interface LowerFormat {
  lowerData: [],
  status: string,
}

export const handler: Handler = async (event: APIGatewayProxyEvent): Promise<ResponseFormat> => {
  return {
    statusCode: StatusCode.OK,
    headers: { 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify(await getLowers(event.queryStringParameters))
  };
};

async function getLowers(qsParam: QueryStringParam): Promise<LowerFormat> {
  const result: LowerFormat = { lowerData: [], status: 'success' };
  console.log('Processing lowers from account: ', qsParam.account);

  try {
    const response = await utils.axios.post(AVN_CONNECTOR_ENDPOINT + 'lowers', { account: qsParam.account });
    result.lowerData = response.data;
  } catch (err) {
    console.log(err);
    result.status = 'error';
  }

  return result;
}
