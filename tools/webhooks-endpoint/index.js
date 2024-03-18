const axios = require('axios');
const crypto = require('crypto');
const express = require('express');
const { format } = require('date-fns');
const formatTS = ts => format(new Date(ts), 'HH:mm:ss.SSS');

const verificationKeyURL = (process.argv[2] || 'https://uat.gateway.aventus.io') + '/webhook-verification-key';

const app = express();

app.use(express.json());

app.listen(4443, async () => {
  console.log('Listening...');
  try {
    await initialiseVerfier();
  } catch (error) {
    console.error('Error fetching verification key');
  }
});

app.get('/ping', (req, res) => {
  console.log('ping!');
  res.status(200).send('pong!');
});

app.post('/listen', (req, res) => {
  const { isVerified, eventId, event, requestId, timestamp, publicKey, data } = decodeEvent(req);
  console.log(`${formatTS(timestamp)} - ${requestId} - ${publicKey} - ${event} - verified: ${isVerified}`);
  res.status(200).send();
});

let verifier;

async function initialiseVerfier() {
  const response = await axios.get(verificationKeyURL);
  verifier = response.data.publicKeyPEM;
}

function decodeEvent(req) {
  const eventId = req.headers['x-avn-event-id'];
  const eventData = req.body;
  const eventSignature = req.headers['x-avn-event-signature'];
  const isVerified = verifyEvent(eventId, eventData, eventSignature);
  const { event, requestId, timestamp, publicKey, data } = eventData;
  return { isVerified, eventId, event, requestId, timestamp, publicKey, data };
}

function verifyEvent(eventId, eventData, eventSignature) {
  const signature = Buffer.from(eventSignature ,'base64');
  const message = Buffer.from(JSON.stringify({ eventId, eventData }));
  try {
    return crypto.verify('SHA256', message, verifier, signature);
  } catch (error) {
    console.error('Verification error:', error);
    return false;
  }
}
