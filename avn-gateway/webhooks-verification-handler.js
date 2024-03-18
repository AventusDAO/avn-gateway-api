const { getPublicKeyPEM } = require('/opt/kmsUtils.js');
const KMS_KEY_ID = process.env.WEBHOOKS_SIGNER_KMS_KEY_ID;

exports.handler = async () => {
  try {
    return { statusCode: 200, body: JSON.stringify({ publicKeyPEM: await getPublicKeyPEM(KMS_KEY_ID) }) };
  } catch (error) {
    console.error('Error getting verification key', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Failed to retrieve verification key' }) };
  }
};
