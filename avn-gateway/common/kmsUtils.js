const crypto = require('crypto');
const { KMSClient, GetPublicKeyCommand, SignCommand } = require('@aws-sdk/client-kms');
const kmsClient = new KMSClient({ region: process.env.AWS_REGION });

async function getVerificationKey(keyId) {
  const getPublicKeyCommand = new GetPublicKeyCommand({ KeyId: keyId });
  const { PublicKey } = await kmsClient.send(getPublicKeyCommand);
  return PublicKey.toString('base64');
}

async function signMessage(keyId, message) {
  const messageDigest = crypto.createHash('sha256').update(string).digest();

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
  getVerificationKey,
  signMessage
};
