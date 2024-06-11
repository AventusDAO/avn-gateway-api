import crypto from 'crypto';
import { KMSClient, GetPublicKeyCommand, SignCommand } from '@aws-sdk/client-kms';

const kmsClient = new KMSClient({ region: process.env.AWS_REGION });

async function getPublicKeyPEM(keyId:string):Promise<string> {
  console.info(`Getting verification key for keyId: ${keyId}`);
  const getPublicKeyCommand = new GetPublicKeyCommand({ KeyId: keyId });
  const { PublicKey } = await kmsClient.send(getPublicKeyCommand);
  const base64Key = Buffer.from(PublicKey).toString('base64');
  return `-----BEGIN PUBLIC KEY-----\n${base64Key.match(/.{1,64}/g).join('\n')}\n-----END PUBLIC KEY-----\n`;
}

async function signMessage(keyId:string, message:string):Promise<string> {
  const messageDigest = crypto.createHash('sha256').update(message).digest();

  const signCommand = new SignCommand({
    KeyId: keyId,
    Message: messageDigest,
    MessageType: 'DIGEST',
    SigningAlgorithm: 'ECDSA_SHA_256'
  });

  const { Signature } = await kmsClient.send(signCommand);
  return Buffer.from(Signature).toString('base64');
}

export { getPublicKeyPEM, signMessage };