import utils from '/opt/utils.js';
import { APIGatewayRequestAuthorizerEvent, APIGatewaySimpleAuthorizerWithContextResult,APIGatewayAuthorizerResultContext } from 'aws-lambda';
import { AxiosResponse } from 'axios';
import { UserInfo, PayerData, AWTToken, ValidRequestContext } from './types';

const axios = utils.axios.default;

const AVN_CONNECTOR_ENDPOINT: string | undefined = process.env.AVN_CONNECTOR_ENDPOINT;
const MAX_TOKEN_AGE_MSEC = parseInt(process.env.MAX_TOKEN_AGE_MSEC as string);
const CLOCK_JITTER_MSEC: number = -15000;
const MIN_AVT_BALANCE = new utils.BN(process.env.MIN_AVT_BALANCE ?? 0);
const AUTH_PREFIX = 'Bearer ';
const InvalidRequestResponse: APIGatewaySimpleAuthorizerWithContextResult<APIGatewayAuthorizerResultContext> = { isAuthorized: false, context: {} };

type AuthorizationResponse = APIGatewaySimpleAuthorizerWithContextResult<ValidRequestContext>

export const handler = async (event: APIGatewayRequestAuthorizerEvent): Promise<AuthorizationResponse> => {
  await utils.init();
  return await validateAwtToken(event);
};

async function validateAwtToken(event: APIGatewayRequestAuthorizerEvent): Promise<AuthorizationResponse> {
  const ValidRequestResponse:AuthorizationResponse = { isAuthorized: true, context: {} };

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

  if (utils.isSplitFeeToken(awtToken) && awtToken.payer) {
    const payerData: PayerData | undefined = await tryGetPayerAddressForUser(awtToken);

    if (payerData?.payerAddress) {
      ValidRequestResponse.context = {
        isSplitFeeUser: true,
        splitFeePayerId: payerData.payerId,
        splitFeePayerVaultId: payerData.vaultId,
        splitFeePayerAddress: payerData.payerAddress
      };
    } else {
      console.info(`No payer found for user ${awtToken.pk}`);
      return InvalidRequestResponse;
    }
  } else {
    if (!(await isValidSelfPayUser(awtToken))) {
      console.info('User does not have enough AVT to access the gateway');
      return InvalidRequestResponse;
    }
  }

  return ValidRequestResponse;
}

function getAwtTokenIfAny(event: APIGatewayRequestAuthorizerEvent): AWTToken | null {
  try {
    const rawToken = event.headers?.authorization;
    if (rawToken?.toLowerCase().startsWith(AUTH_PREFIX.toLowerCase())) {
      const decodedToken = Buffer.from(rawToken.split(' ')[1], 'base64').toString('ascii');
      return JSON.parse(decodedToken);
    }
  } catch (err) {
    console.error('failed to extract AWT token', err);
    return null;
  }
  return null;
}

function tokenAgeIsValid(token: AWTToken): boolean {
  try {
    const issuedAt = new Date(token.iat);
    const tokenAge = new Date().getTime() - issuedAt.getTime();
    return tokenAge >= CLOCK_JITTER_MSEC && tokenAge < MAX_TOKEN_AGE_MSEC;
  } catch (err) {
    console.error('failed to check AWT token age', err);
    return false;
  }
}

async function isValidSelfPayUser(awtToken: AWTToken): Promise<boolean> {
  const userInfo: UserInfo | undefined = await tryGetUserInfo(awtToken);
  if (!userInfo) return false;

  const avtBalance = new utils.BN(userInfo.freeBalance.toString().replace('0x', ''), 16);
  const existingUser = new utils.BN(userInfo.paymentNonce).gt(new utils.BN(0));

  return existingUser || avtBalance.gte(MIN_AVT_BALANCE);
}

async function tryGetPayerAddressForUser(awtToken: AWTToken): Promise<PayerData | undefined> {
  try {
    const avnResponse: AxiosResponse = await axios.post(`${AVN_CONNECTOR_ENDPOINT}getPayer`, {
      user: awtToken.pk,
      payer: awtToken.payer
    });

    return avnResponse.data;
  } catch (err) {
    console.error('Failed to get payer data: ', err);
    return undefined;
  }
}

async function tryGetUserInfo(awtToken: AWTToken): Promise<UserInfo | undefined> {
  try {
    const avnResponse: AxiosResponse = await axios.post(`${AVN_CONNECTOR_ENDPOINT}gatewayUserInfo`, {
      account: awtToken.pk
    });

    return avnResponse.data;
  } catch (err) {
    console.error('Failed to get user info from chain', err);
    return undefined;
  }
}
