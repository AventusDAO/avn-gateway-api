import { getPublicKeyPEM } from '/opt/kmsUtils.js';
import { StatusCode } from '/opt/handler-types';
// @ts-ignore
import { Handler, APIGatewayProxyResult } from 'aws-lambda';

const KMS_KEY_ID = process.env.WEBHOOKS_SIGNER_KMS_KEY_ID!;

export const handler: Handler = async (): Promise<APIGatewayProxyResult> => {
  try {
    return { statusCode: StatusCode.OK, body: JSON.stringify({ publicKeyPEM: await getPublicKeyPEM(KMS_KEY_ID) }) };
  } catch (error) {
    console.error('Error getting verification key', error);
    return { statusCode: StatusCode.InternalServerError, body: JSON.stringify({ error: 'Failed to retrieve verification key' }) };
  }
};
