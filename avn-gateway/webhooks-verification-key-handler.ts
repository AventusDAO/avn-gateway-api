import { getPublicKeyPEM } from '/opt/kmsUtils.js';
import { Handler } from 'aws-lambda';
const KMS_KEY_ID = process.env.WEBHOOKS_SIGNER_KMS_KEY_ID!;

export interface ResponseFormat {
  statusCode: number,
  body: string,
}

export const handler: Handler = async (): Promise<ResponseFormat> => {
  try {
    return { statusCode: 200, body: JSON.stringify({ publicKeyPEM: await getPublicKeyPEM(KMS_KEY_ID) }) };
  } catch (error) {
    console.error('Error getting verification key', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Failed to retrieve verification key' }) };
  }
};
