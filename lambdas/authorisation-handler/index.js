const axios = require('axios');
const bigInt = require('big-integer');
const { cryptoWaitReady, signatureVerify } = require('@polkadot/util-crypto');
const { TypeRegistry } = require('@polkadot/types');

const AVN_API_QUERY_ENDPOINT = 'http://ec2-35-178-74-219.eu-west-2.compute.amazonaws.com:3000/avnQuery';
const SIGNING_CONTEXT = 'awt_gateway_api';
const MAX_TOKEN_AGE_MSEC = 60000;
const MIN_AVT_BALANCE = bigInt("100000000000000000000");
const AUTH_PREFIX = 'Bearer ';
const registry = new TypeRegistry();

const InvalidRequestResponse = {
  "isAuthorized": false
};

const ValidRequestResponse = {
  "isAuthorized": true
};

exports.handler = async(event) => {

  console.log("Authorisation lambda called");

  const awtToken = getAwtTokenIfAny(event);

  if (awtToken) {
      // check the age of the token
      if (tokenAgeIsValid(awtToken) !== true) {
        console.log(`Token is either expired or issued in the future`);
        return InvalidRequestResponse;
      }

      // check the signature
      if (isSignatureValid(awtToken) !== true) {
        console.log(`The avnPublicKey signature is not valid`);
        return InvalidRequestResponse;
      }

      // check the user balance on the chain
      const hasAvtBalance = await userHasAvtBalance(awtToken);
      if (hasAvtBalance !== true) {
        console.log(`User does not have enough balance to use the avn gateway api`);
        return InvalidRequestResponse;
      }

      return ValidRequestResponse;
  }

  return InvalidRequestResponse;
};

async function userHasAvtBalance(awtToken) {
  // query the chain for balance info
  try {
    const response = await axios.post(AVN_API_QUERY_ENDPOINT, {palletName: 'system', storageName: 'account', params: [awtToken.pk]});
    const avtBalance = bigInt(response.data.data.free.replace('0x',''), 16);
    return avtBalance.gt(MIN_AVT_BALANCE);
  } catch (err) {
    console.log(`Error checking AVT balance for user: ${err}`);
    return false;
  }
}

function isSignatureValid(awtToken) {
  // run this await code after as much validation as possible
  await cryptoWaitReady();

  const encodedAvnPublicKey = encodeAvnPublicKeyForVerification(awtToken.pk, awtToken.iat);

  const verificationResult = await signatureVerify(encodedAvnPublicKey, awtToken.sig, awtToken.pk);
  return verificationResult.isValid;
}

function tokenAgeIsValid(token) {
  const issuedAt = new Date(token.iat);
  const tokenAge = new Date() - issuedAt;

  return tokenAge > 0 && tokenAge > MAX_TOKEN_AGE_MSEC;
}

function getAwtTokenIfAny(event) {
  try {
    const rawToken = event.headers.authorization;
    if (rawToken && (rawToken.startsWith(AUTH_PREFIX) || rawToken.startsWith(AUTH_PREFIX.toLowerCase()))) {
      const decodedToken = Buffer.from(rawToken.split(' ')[1], 'base64').toString('ascii');
      return JSON.parse(decodedToken);
    }
  } catch (err) {
    console.error(`Error extracting awt token from request: ${err}`)
  }

  return null;
}

function encodeAvnPublicKeyForVerification(avnPublicKey, issuedAt) {
  const encodedData = u8aConcat(
      registry.createType('Text', SIGNING_CONTEXT).toU8a(false),
      registry.createType('AccountId', hexToU8a(avnPublicKey)).toU8a(true),
      registry.createType('Text', issuedAt).toU8a(false)
  );

  return u8aToHex(encodedData);
}