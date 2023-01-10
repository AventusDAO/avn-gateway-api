const utils = require('/opt/utils.js');

const AVN_CONNECTOR_ENDPOINT = process.env.AVN_CONNECTOR_ENDPOINT;
const MAX_TOKEN_AGE_MSEC = process.env.MAX_TOKEN_AGE_MSEC;
const CLOCK_JITTER_MSEC = -15000;
const MIN_AVT_BALANCE = new utils.BN(process.env.MIN_AVT_BALANCE);
const AUTH_PREFIX = 'Bearer ';
const InvalidRequestResponse = { isAuthorized: false };
const ValidRequestResponse = { isAuthorized: true };

exports.handler = async event => {
  await utils.init();
  return await validateAwtToken(event);
};

async function validateAwtToken(event) {
  console.info('Validating AWT token and user balance');
  const awtToken = getAwtTokenIfAny(event);

  if (!awtToken) {
    console.info('Invalid AWT token - token not found');
    return InvalidRequestResponse;
  }

  console.info(`Public key: ${awtToken.pk}`);

  if (!tokenAgeIsValid(awtToken)) {
    console.info('Invalid AWT token - outside window');
    return InvalidRequestResponse;
  }

  if (!utils.verifyAwtTokenSignature(awtToken.pk, awtToken.iat, awtToken.sig, awtToken.hasPayer, awtToken.payer)) {
    console.info('Invalid AWT token - bad signature');
    return InvalidRequestResponse;
  }

  if (isValidSelfPayUser(awtToken) === false) {
    console.info('User does not have enough AVT to access the gateway');
    return InvalidRequestResponse;
  }

  return ValidRequestResponse;
}

function getAwtTokenIfAny(event) {
  try {
    const rawToken = event.headers.authorization;
    if (rawToken && rawToken.toLowerCase().startsWith(AUTH_PREFIX.toLowerCase())) {
      const decodedToken = Buffer.from(rawToken.split(' ')[1], 'base64').toString('ascii');
      return JSON.parse(decodedToken);
    }
  } catch (err) {
    console.error('failed to extract AWT token', err);
    return null;
  }
}

function tokenAgeIsValid(token) {
  try {
    const issuedAt = new Date(token.iat);
    const tokenAge = new Date() - issuedAt;
    return tokenAge >= CLOCK_JITTER_MSEC && tokenAge < MAX_TOKEN_AGE_MSEC;
  } catch (err) {
    console.error('failed to check AWT token age', err);
    return false;
  }
}

async function isValidSelfPayUser(token) {
  const userInfo = await tryGetUserInfo(awtToken);
  if (!userInfo) return false;

  const avtBalance = new utils.BN(userInfo.freeBalance.toString().replace('0x', ''), 16);
  const existingUser = new utils.BN(userInfo.paymentNonce).gt(new utils.BN(0));

  return existingUser === true || avtBalance.gte(MIN_AVT_BALANCE);
}

async function tryGetUserInfo(awtToken) {
  try {
    const avnResponse = await utils.axios.post(AVN_CONNECTOR_ENDPOINT + 'gatewayUserInfo', {
      account: awtToken.pk
    });

    return avnResponse.data;
  } catch (err) {
    console.error('Failed to get user info from chain', err);
    return undefined;
  }
}
