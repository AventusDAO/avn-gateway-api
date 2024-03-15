const axios = require('axios');
const crypto = require('crypto');
const express = require('express');
const { format } = require('date-fns');
const formatTS = ts => format(new Date(ts), 'HH:mm:ss.SSS');
const verificationKeyURL = (process.argv[2] || 'https://uat.gateway.aventus.io') + '/webhook-verification-key';
const app = express();
app.use(express.json());

let verificationKey;

app.listen(4443, async () => {
  console.log('Listening...');
  try {
    verificationKey = await getVerificationKey();
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

async function getVerificationKey() {
  const response = await axios.get('https://uat.gateway.aventus.io/webhook-verification-key');
  const base64Key = response.data.verificationKey;
  return `-----BEGIN PUBLIC KEY-----\n${base64Key.match(/.{1,64}/g).join('\n')}\n-----END PUBLIC KEY-----\n`;
}

function decodeEvent(req) {
  const eventData = req.body;
  const eventId = req.headers['x-avn-event-id'];
  const eventSignature = req.headers['x-avn-event-signature'];
  const isVerified = verifyEvent(eventData, eventId, eventSignature);
  const { event, requestId, timestamp, publicKey, data } = eventData;
  return { isVerified, eventId, event, requestId, timestamp, publicKey, data };
}

function verifyEvent(eventData, eventId, eventSignature) {
  const message = JSON.stringify({ eventId, eventData });
  const messageDigest = crypto.createHash('sha256').update(message).digest();
  const signature = Buffer.from(eventSignature, 'base64');
  return crypto.verify('sha256', messageDigest, verificationKey, signature);
}