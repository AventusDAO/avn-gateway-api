const express = require('express');
const { format } = require('date-fns');
const localtunnel = require('localtunnel');
const Verifier = require('./verifier.js');

const verifier = new Verifier();
const app = express();
app.use(express.json());

async function openTunnel(subdomain = 'avnwebhookstest') {
  const tunnel = await localtunnel({ port: 4443, subdomain });
  if (tunnel.url.match(/\/\/(.*?)\./)?.[1] !== subdomain) {
    throw new Error(`Local tunnel cannot provide "${subdomain}", wait and retry or specify a different subdomain`);
  }
  return tunnel.url;
}

app.listen(4443, async () => {
  try {
    const url = await openTunnel(process.argv[2]);
    await verifier.init(process.argv[3]);
    console.log(`Server listening at ${url}...`);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
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
