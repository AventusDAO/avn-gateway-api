const utils = require('/opt/utils.js');
const MQSender = require('/opt/mqSender.js');

let mqSender;

exports.handler = async payload => {
  console.log('Payout staker lambda invoked with payload: ', payload);
  try {
    await connectToMQ();

    const response = {
      statusCode: 200,
      body: JSON.stringify(await processRequest(payload))
    };

    return response;
  } catch (err) {
    console.log('Error paying out staking rewards: ', err);
    return {
      statusCode: 500,
      error: { message: err.message, payload }
    };
  }
};

const connectToMQ = async () => {
  if (!mqSender || !mqSender.amqpConnection || !mqSender.amqpConnected) {
    mqSender = new MQSender(process.env.SECRET_MANAGER_REGION, process.env.MQ_SECRET_ARN, process.env.MQ_BROKER_AMQP_ENDPOINT);
    await mqSender.connectToMessageBroker();
  }
};

// We expect that election status has been checked before calling this internal lambda
async function processRequest(call) {
  call.id = 1;
  call.requestId = 'automatedStakersPayout';

  const pallet = 'validatorsManager';
  const method = 'signedPayoutStakers';

  const { era, relayer, user, payer, proxySignature } = call.params;

  try {
    if (utils.isValidNumber(era) === false) throw 'era';
    if (utils.isValidAccountId(relayer) === false) throw 'relayer';
    if (utils.isValidAccountId(user) === false) throw 'user';
    if (utils.isValidAccountId(payer) === false) throw 'payer';
    if (utils.isValidSignatureFormat(proxySignature) === false) throw 'proxy signature format';
  } catch (err) {
    return utils.errorResponse('params', err.toString(), err, call, call.id);
  }

  const proxyProof = {
    signer: user,
    relayer,
    signature: {
      Sr25519: proxySignature
    }
  };

  const params = {
    proxyParams: [proxyProof].concat([era]),
    relayerAddress: relayer,
    paymentInfo: null
  };

  return await sendTx(call, pallet, method, params);
}

async function sendTx(call, palletName, method, params) {
  try {
    console.log('Sending payout transaction to the queue');
    const queue = process.env.MQ_AVN_TX_QUEUE;
    const txType = 'avnProxy';
    const result = await mqSender.sendMessageToMQ(queue, { call: call.requestId, txType, palletName, method, params });
    return utils.validResponse(call.id, result);
  } catch (err) {
    return utils.errorResponse('internal', 'failed to send proxy transaction', err, call, call.id);
  }
}
