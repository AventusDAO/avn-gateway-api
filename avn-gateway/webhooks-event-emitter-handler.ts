import { axios, callWithTimeout } from '/opt/utils';
import { signMessage } from '/opt/kmsUtils.js';
import { getFailedMessagesForFifoQueue } from '/opt/sqsUtils.js';
import { CustomSQSHandler, EventRecord, Event } from '/opt/handler-types';
// @ts-ignore
import { SQSBatchResponse, SQSEvent, Context } from 'aws-lambda';

const KMS_KEY_ID = process.env.WEBHOOKS_SIGNER_KMS_KEY_ID!;

export const handler: CustomSQSHandler = async (event: SQSEvent, context: Context): Promise<void|SQSBatchResponse> => {
  let acknowledgedEvents = 0;

  try {
    for (const record of event.Records) {
      await callWithTimeout(context.getRemainingTimeInMillis(), processRecordAndEmitEvent, [record]);
      acknowledgedEvents++;
    }
  } catch (error) {
    console.error('Error emitting events', error);
    if (acknowledgedEvents === 0) throw error;
    else return { batchItemFailures: getFailedMessagesForFifoQueue(event.Records, acknowledgedEvents) };
  }
};

async function processRecordAndEmitEvent(record: EventRecord): Promise<void> {
  const event = await processRecord(record);
  await emitEvent(event);
}

async function processRecord(record: EventRecord): Promise<Event> {
  try {
    const id = record.messageId;
    const { endpoint, eventData: data } = JSON.parse(record.body);
    const freshness = new Date().toISOString();
    const message = JSON.stringify({ id, freshness, data });
    const signature = await signMessage(KMS_KEY_ID, message);
    return { id, freshness, signature, endpoint, data };
  } catch (error) {
    throw new Error(`Error processing record: ${error.message}`);
  }
}

async function emitEvent(event: Event): Promise<void> {
  const { id, freshness, signature, endpoint, data } = event;
  const headers = {
    'content-type': 'application/json',
    'x-avn-event-id': id,
    'x-avn-event-freshness': freshness,
    'x-avn-event-signature': signature
  };

  try {
    await axios.post(endpoint, data, { headers });
  } catch (error) {
    throw new Error(`Error emitting event ${id} for ${endpoint} ${error.response ? error.response.statusText : error.message}`);
  }
}
