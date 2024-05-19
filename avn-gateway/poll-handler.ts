import { init, buildErrorBody, isValidRequestId, buildValidResponseBody, axios } from '/opt/utils.js';
import { ValidError, Call } from './types';
import { ErrorBody } from './common/types';
// @ts-ignore
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

const AVN_CONNECTOR_ENDPOINT: string | undefined = process.env.AVN_CONNECTOR_ENDPOINT;

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  await init();
  return {
    statusCode: 200,
    body: JSON.stringify(await processRequest(event.body))
  };
};

async function processRequest(request: string): Promise<ValidError | ErrorBody> {
  let call: Call;

  try {
    call = JSON.parse(request);
  } catch (err) {
    return buildErrorBody('parse', 'failed to parse JSON', err.toString(), request, null);
  }

  if (call.id === undefined) call.id = null;

  if (typeof call.method !== 'string') {
    return buildErrorBody('request', 'method type must be string', call.method, request, call.id);
  } else {
    return await makeCall(call, request);
  }
}

async function makeCall(call: Call, request: string): Promise<ValidError | ErrorBody> {
  console.info(`Processing call: ${JSON.stringify(call)}`);

  if (call.method !== 'requestState') {
    return buildErrorBody('method', "method must be 'requestState'", call.method, request, call.id);
  }

  const { requestId } = call.params ?? {};

  if (isValidRequestId(requestId) === false) {
    return buildErrorBody('params', 'invalid request ID', requestId, request, call.id);
  }

  return await poll(call, request, requestId);
}

async function poll(call: Call, request: string, requestId?: string): Promise<ValidError | ErrorBody> {
  try {
    const callId = call.id;
    const avnResponse = await axios.post(AVN_CONNECTOR_ENDPOINT + 'avnPoll', { callId, requestId });

    if (!avnResponse.data)
      return buildErrorBody('internal', 'failed to poll chain', 'Invalid data returned', request, call.id);
    if (avnResponse.data.error)
      return buildErrorBody('internal', 'failed to poll chain', avnResponse.data.error, request, call.id);

    return buildValidResponseBody(callId, avnResponse.data);
  } catch (err: any) {
    return buildErrorBody('internal', 'failed to poll chain', err.toString(), request, call.id);
  }
}
