import utils from '/opt/utils.js';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

const axios = utils.axios.default;

interface Call {
  id: string | null;
  method: string;
  params?: {
    requestId: string;
  };
}

interface ErrorResponse {
  jsonrpc: string;
  id: string | null;
  error?: {
    code: number;
    message: string;
    data?: any;
  }
}

interface ValidResponse {
  statusCode: number;
  body: string;
}

const AVN_CONNECTOR_ENDPOINT: string | undefined = process.env.AVN_CONNECTOR_ENDPOINT;

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  await utils.init();
  return {
    statusCode: 200,
    body: JSON.stringify(await processRequest(event.body))
  };
};

async function processRequest(request: string): Promise<ErrorResponse | ValidResponse> {
  let call: Call;

  try {
    call = JSON.parse(request);
  } catch (err) {
    return utils.buildErrorBody('parse', 'failed to parse JSON', err.toString(), request, null);
  }

  if (call.id === undefined) call.id = null;

  if (typeof call.method !== 'string') {
    return utils.buildErrorBody('request', 'method type must be string', call.method, request, call.id);
  } else {
    return await makeCall(call, request);
  }
}

async function makeCall(call: Call, request: string): Promise<ErrorResponse | ValidResponse> {
  console.info(`Processing call: ${JSON.stringify(call)}`);

  if (call.method !== 'requestState') {
    return utils.buildErrorBody('method', "method must be 'requestState'", call.method, request, call.id);
  }

  const { requestId } = call.params ?? {};

  if (utils.isValidRequestId(requestId) === false) {
    return utils.buildErrorBody('params', 'invalid request ID', requestId, request, call.id);
  }

  return await poll(call, request, requestId);
}

async function poll(call: Call, request: string, requestId?: string): Promise<ErrorResponse | ValidResponse> {
  try {
    const callId = call.id;
    const avnResponse = await axios.post(AVN_CONNECTOR_ENDPOINT + 'avnPoll', { callId, requestId });

    if (!avnResponse.data)
      return utils.buildErrorBody('internal', 'failed to poll chain', 'Invalid data returned', request, call.id);
    if (avnResponse.data.error)
      return utils.buildErrorBody('internal', 'failed to poll chain', avnResponse.data.error, request, call.id);

    return utils.buildValidResponseBody(callId, avnResponse.data);
  } catch (err: any) {
    return utils.buildErrorBody('internal', 'failed to poll chain', err.toString(), request, call.id);
  }
}
