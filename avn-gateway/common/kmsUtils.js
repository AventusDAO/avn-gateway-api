const crypto = require('crypto');
const { KMSClient, GetPublicKeyCommand, SignCommand } = require('@aws-sdk/client-kms');
const kmsClient = new KMSClient({ region: process.env.AWS_REGION });

async function getPublicKeyPEM(keyId) {
  const getPublicKeyCommand = new GetPublicKeyCommand({ KeyId: keyId });
  const { PublicKey, PublicKeyEncoding } = await kmsClient.send(getPublicKeyCommand);
  if (PublicKeyEncoding === 'PEM') {
    return PublicKey.toString();
  } else {
    const base64Key = Buffer.from(PublicKey).toString('base64');
    return `-----BEGIN PUBLIC KEY-----\n${base64Key.match(/.{1,64}/g).join('\n')}\n-----END PUBLIC KEY-----\n`;
  }
}

async function signMessage(keyId, message) {
  const messageDigest = crypto.createHash('sha256').update(message).digest();

  const signCommand = new SignCommand({
    KeyId: keyId,
    Message: messageDigest,
    MessageType: 'DIGEST',
    SigningAlgorithm: 'ECDSA_SHA_256'
  });

  const { Signature } = await kmsClient.send(signCommand);
  return Signature.toString('base64');
}

module.exports = {
  getPublicKeyPEM,
  signMessage
};
