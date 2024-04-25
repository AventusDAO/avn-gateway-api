import { getPublicKeyPEM } from '/opt/kmsUtils.js';
import { Handler } from 'aws-lambda';
const KMS_KEY_ID = process.env.WEBHOOKS_SIGNER_KMS_KEY_ID!;

enum StatusCode {
  OK = 200,
  MultiStatus = 207,
  InternalServerError = 500
}

export interface ResponseFormat {
  statusCode: StatusCode,
  body: string,
}

export const handler: Handler = async (): Promise<ResponseFormat> => {
  try {
    return { statusCode: StatusCode.OK, body: JSON.stringify({ publicKeyPEM: await getPublicKeyPEM(KMS_KEY_ID) }) };
  } catch (error) {
    console.error('Error getting verification key', error);
    return { statusCode: StatusCode.InternalServerError, body: JSON.stringify({ error: 'Failed to retrieve verification key' }) };
  }
};
