const EC2 = require('../common/resources.json').ec2_endpoint;
const utils = require('../common/utils.js');
const axios = require('axios');
const BN = require('bn.js');
const { hexToU8a, u8aToHex, u8aConcat } = require('@polkadot/util');
const { cryptoWaitReady, signatureVerify } = require('@polkadot/util-crypto');
const { TypeRegistry } = require('@polkadot/types');

const SIGNING_CONTEXT = 'awt_gateway_api';
const MAX_TOKEN_AGE_MSEC = 60000;
const CLOCK_JITTER_MSEC = -15000;
const MIN_AVT_BALANCE = new BN('100000000000000000000');
const AUTH_PREFIX = 'Bearer ';
const registry = new TypeRegistry();

const InvalidRequestResponse = {isAuthorized: false};
const ValidRequestResponse = {isAuthorized: true};

let userRequestId;

exports.handler = async(event) => {
  try {
    userRequestId = (JSON.parse(event.body)).id;
  } catch (e) {
    userRequestId = null;
  }
  // encapsulate all the logic to make local testing easier
  return await validateAwtToken(event);
};

async function validateAwtToken(event) {
  console.log('Authorisation lambda called');

  const awtToken = getAwtTokenIfAny(event);

  if (!awtToken || !tokenAgeIsValid(awtToken) || !(await isSignatureValid(awtToken)) || !(await userHasAvtBalance(awtToken)) {
    return InvalidRequestResponse;
  }

  return ValidRequestResponse;
}

/*
    Helper functions
*/

async function userHasAvtBalance(awtToken) {
  // query the chain for balance info
  try {
    const response = await axios.post(EC2 + 'avnQuery', {palletName: 'system', storageName: 'account', params: [awtToken.pk]});
    const avtBalance = new BN(response.data.data.free.replace('0x',''), 16);
    return avtBalance.gte(MIN_AVT_BALANCE);
  } catch (err) {
    utils.logError(userRequestId, 'userHasAvtBalance', err);
    return false;
  }
}

async function isSignatureValid(awtToken) {
  try {
    // run this await code after as much validation as possible
    await cryptoWaitReady();

    const encodedAvnPublicKey = encodeAvnPublicKeyForVerification(awtToken.pk, awtToken.iat);
    const verificationResult = signatureVerify(encodedAvnPublicKey, awtToken.sig, awtToken.pk);
    return verificationResult.isValid;
  } catch (err) {
    utils.logError(userRequestId, 'isSignatureValid', err);
    return false;
  }
}

function tokenAgeIsValid(token) {
  try {
    const issuedAt = new Date(token.iat);
    const tokenAge = new Date() - issuedAt;

    return tokenAge >= CLOCK_JITTER_MSEC && tokenAge < MAX_TOKEN_AGE_MSEC;
  } catch (err) {
    utils.logError(userRequestId, 'tokenAgeIsValid', err);
    return false;
  }
}

function getAwtTokenIfAny(event) {
  try {
    const rawToken = event.headers.authorization;
    if (rawToken && (rawToken.toLowerCase().startsWith(AUTH_PREFIX.toLowerCase()))) {
      const decodedToken = Buffer.from(rawToken.split(' ')[1], 'base64').toString('ascii');
      return JSON.parse(decodedToken);
    }
  } catch (err) {
    utils.logError(userRequestId, 'getAwtTokenIfAny', err);
    return null;
  }
}

function encodeAvnPublicKeyForVerification(avnPublicKey, issuedAt) {
  const encodedData = u8aConcat(
    registry.createType('Text', SIGNING_CONTEXT).toU8a(false),
    registry.createType('AccountId', hexToU8a(avnPublicKey)).toU8a(true),
    registry.createType('Text', issuedAt).toU8a(false)
  );

  return u8aToHex(encodedData);
}
