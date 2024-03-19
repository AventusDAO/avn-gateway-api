const express = require('express');
const { format } = require('date-fns');
const Verifier = require('./verifier.js');

const verifier = new Verifier();
const app = express();
app.use(express.json());

app.listen(4443, async () => {
  console.log('Listening...');
});

app.get('/ping', (req, res) => {
  console.log('ping!');
  res.status(200).send('pong!');
});

app.post('/listen', (req, res) => {
  try {
    const { event, requestId, timestamp, publicKey, data } = verifier.verifyEvent(req);
    console.log(`${format(new Date(timestamp), 'HH:mm:ss.SSS')} - ${requestId} - ${publicKey} - ${event}`);
    res.status(200).send();
  } catch (error) {
    console.error(error);
    res.status(400).send('Verification failed');
  }
});
