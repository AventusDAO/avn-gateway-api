import { getPublicKeyPEM } from '/opt/kmsUtils.js';
import { Handler, APIGatewayProxyResult } from 'aws-lambda';
import { StatusCode } from './types';

const KMS_KEY_ID = process.env.WEBHOOKS_SIGNER_KMS_KEY_ID!;

export const handler: Handler = async (): Promise<APIGatewayProxyResult> => {
  try {
    return { statusCode: StatusCode.OK, body: JSON.stringify({ publicKeyPEM: await getPublicKeyPEM(KMS_KEY_ID) }) };
  } catch (error) {
    console.error('Error getting verification key', error);
    return { statusCode: StatusCode.InternalServerError, body: JSON.stringify({ error: 'Failed to retrieve verification key' }) };
  }
};
