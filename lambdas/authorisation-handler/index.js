const { cryptoWaitReady, signatureVerify } = require('@polkadot/util-crypto');
const { TypeRegistry } = require('@polkadot/types');

const SIGNING_CONTEXT = 'awt_gateway_api';
const MAX_TOKEN_AGE_MSEC = 60000;
const registry = new TypeRegistry();


exports.handler = async(event) => {
  const tokenPrefix = 'Bearer ';
  console.log("Authorisation lambda called");

  let response = {
      "isAuthorized": false
  };

  const hasAwtToken = event.headers.authorization &&
      (event.headers.authorization.startsWith(tokenPrefix) || event.headers.authorization.startsWith(tokenPrefix.toLowerCase()));

  if (hasAwtToken) {
      const token = event.headers.authorization.split(' ')[1];
      const decodedToken = JSON.parse(Buffer.from(token, 'base64').toString('ascii'));

      // check the age of the token
      const issuedAt = new Date(decodedToken.iat);
      const tokenAge = new Date() - issuedAt;

      if (tokenAge < 0 || tokenAge > MAX_TOKEN_AGE_MSEC) {
        response.isAuthorized = false;
        console.log(`Token is either expired or issue in the future`);
      }

      const encodedAvnPublicKey = encodeAvnPublicKeyForVerification(decodedToken.pk, decodedToken.iat);

      // no point doing this before we make sure there is a valid token
      await cryptoWaitReady();

      const verificationResult = await signatureVerify(encodedAvnPublicKey, decodedToken.sig, decodedToken.pk);
      if (verificationResult.isValid === true) {
        response.isAuthorized = true;
      }
  }

  return response;
};

function encodeAvnPublicKeyForVerification(avnPublicKey, issuedAt) {
  const encodedData = u8aConcat(
      registry.createType('Text', SIGNING_CONTEXT).toU8a(false),
      registry.createType('AccountId', hexToU8a(avnPublicKey)).toU8a(true),
      registry.createType('Text', issuedAt).toU8a(false)
  );

  return u8aToHex(encodedData);
}