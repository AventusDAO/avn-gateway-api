const axios = require('axios');
const helper = require('./helper.js');

async function getAccessToken() {
  const res = await axios.post(`${helper.splitFeeConfig.baseUrl}/payer-token`, {
    username: helper.splitFeeConfig.username,
    password: helper.splitFeeConfig.password
  });
  return res.data?.data;
}

async function splitFeeUserExists(userPublicKey, reAttempts = 0) {
  const token = await getAccessToken();
  const headers = {
    'Content-Type': 'application/json',
    accessToken: token
  };

  try {
    const res = await axios.get(
      `${helper.splitFeeConfig.baseUrl}/sf-users/${helper.splitFeeConfig.payerId}?search=${userPublicKey}`,
      { headers }
    );

    return res?.data?.count > 0;
  } catch (err) {
    if (err.response?.status === 401 && reAttempts === 0) {
      console.warn(`[splitFeeUserExists] 401 received, retrying with fresh token`);
      return await splitFeeUserExists(userPublicKey, 1);
    }

    throw err;
  }
}

async function registerSplitFeeUser(userPublicKey) {
  const exists = await splitFeeUserExists(userPublicKey);
  if (exists) {
    console.log(`[splitFee] User already exists: ${userPublicKey}`);
    return;
  }

  const token = await getAccessToken();
  const headers = {
    'Content-Type': 'application/json',
    accessToken: token
  };

  await axios.post(
    `${helper.splitFeeConfig.baseUrl}/sf-users/add`,
    {
      payerId: helper.splitFeeConfig.payerId,
      publicKey: userPublicKey,
      description: 'gateway tests split fee user'
    },
    { headers }
  );
  console.log(`[splitFee] Registered new user: ${userPublicKey}`);
}

module.exports = {
  getAccessToken,
  splitFeeUserExists,
  registerSplitFeeUser
};
