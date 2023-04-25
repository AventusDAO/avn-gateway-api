const utils = require('/opt/utils.js');
const fees = require('/opt/paymentUtils.js');
const sqs = require('/opt/sqsUtils.js');

const sqsClient = new sqs.SQSClient({ region: process.env.SECRET_MANAGER_REGION });
const DEFAULT_SQS_URL = process.env.SQS_DEFAULT_QUEUE_URL;
const AVN_CONNECTOR_ENDPOINT = process.env.AVN_CONNECTOR_ENDPOINT;

exports.handler = async (event, context) => {
  let processedMessagesCount = 0;
  let paymentNonces = {};

  try {
    if (!event.Records) {
      console.log(`No messages to process.`);
      return {
        statusCode: 200,
        body: `No messages to process`
      };
    }

    console.log(`Processing ${event.Records.length} message(s) from queue`);
    let result;
    for (let record of event.Records) {
      const timeoutMs = context.getRemainingTimeInMillis() - utils.ONE_SECOND;
      if (timeoutMs > 0) {
        result = await utils.callWithTimeout(timeoutMs, processRequest, [record.body, paymentNonces]);
      } else {
        throw new Error("Lambda execution exceeded allowed time");
      }

      if (utils.requestFailed(result) === true) {
        // Stop on the first failure because this is a FIFO queue
        break;
      }

      processedMessagesCount += 1;
    }

    if (processedMessagesCount < event.Records.length) {
      console.warn(`Processed ${processedMessagesCount} out of ${event.Records.length} message(s) successfully.`);
      return {
        batchItemFailures: sqs.getFailedMessagesForFifoQueue(event.Records, processedMessagesCount)
      };
    }

    return {
      statusCode: 200,
      body: `${event.Records.length} message(s) processed successfully.`
    };
  } catch (err) {
    console.error(`Failed to process messages from payer queue: `, err);

    return {
      batchItemFailures: sqs.getFailedMessagesForFifoQueue(event.Records, processedMessagesCount)
    };
  }
};

async function processRequest(request, paymentNonces) {
  let tx;
  let requestId;

  try {
    tx = JSON.parse(request);
    requestId = tx.awsRequestId;
  } catch (err) {
    console.error(`Failed to parse message as JSON: `, err);
    return utils.buildErrorBody('parse', 'Failed to parse message as JSON', err.toString(), request, null);
  }

  try {
    console.info('CALLID_TO_REQUESTID:', tx.id + ' : ' + requestId);
    validateTransaction(tx);

    if (await payerCanPayForTransaction(tx.splitFeePayerAddress, tx.method) === false) {
      // transaction has been rejected by payer, inform user
      await updateTransactionStatusToRejected(requestId);
      return;
    }

    const relayerFee = await utils.getRelayerFee(AVN_CONNECTOR_ENDPOINT, call.params.relayer, call.splitFeePayerAddress, call.method);
    tx.params.payer = tx.splitFeePayerAddress;
    tx.relayerFee = relayerFee;

    const data = await sendMessageToDefaultQueue(tx);
    console.info(
      `Sent updated transaction to default SQS. txID: ${tx.id}, awsRequestId: ${tx.awsRequestId}, sqsMessageId: ${data.MessageId}`
    );
    return utils.buildValidResponseBody(tx.id, requestId);
  } catch (err) {
    console.error(`Failed to process message from split fee queue: `, err);
    return utils.buildErrorBody('request', 'Failed to process message from split fee queue', err.toString(), request, tx.id);
  }
}

function validateTransaction(tx) {
  try {
    if (utils.isValidAccountId(tx.params.relayer) === false) throw 'relayer';
    if (utils.isValidAccountId(tx.params.user) === false) throw 'user';
    if (utils.isValidNumber(tx.splitFeePayerId) === false) throw 'splitFeePayerId';
    if (utils.isValidString(tx.splitFeePayerVaultId) === false) throw 'splitFeePayerVaultId';
    if (utils.isValidAccountId(tx.splitFeePayerAddress) === false) throw 'splitFeePayerAddress';
    if (utils.isValidSignatureFormat(tx.params.proxySignature) === false) throw 'proxy signature format';
  } catch (errParam) {
    throw new Error(`Invalid transaction data: ${errParam}`);
  }
}

async function sendMessageToDefaultQueue(message) {
  const messageBody = JSON.stringify(message);

  const params = {
    QueueUrl: DEFAULT_SQS_URL,
    MessageGroupId: 'DEFAULT',
    MessageDeduplicationId: utils.hashString(messageBody),
    MessageBody: messageBody
  };

  return await sqsClient.send(new sqs.SendMessageCommand(params));
}

async function payerCanPayForTransaction(payerAddress, transactionName) {
  try {
    const avnResponse = await utils.axios.post(AVN_CONNECTOR_ENDPOINT + 'isPayerTransaction', {
      payer: payerAddress,
      transaction: transactionName
    });

    return avnResponse.data === true;
  } catch (err) {
    console.error(`Failed to check if payer ${payerAddress} can pay for transaction ${transactionName}:`, err.toString());
    throw err;
  }
}

async function updateTransactionStatusToRejected(requestId) {
  try {
    await utils.axios.post(AVN_CONNECTOR_ENDPOINT + 'setTransactionRefusedByPayerStatus', { requestId: requestId });
  } catch (err) {
    console.error(`Failed to set status of requestId ${requestId} as 'Rejected by payer':`, err.toString());
    throw err;
  }
}
