const crypto = require('crypto');
const axios = require('axios');

class Verifier {
  constructor() {
    this.publicKeyPEM = null;
  }

  async init(freshnessWindow = 5000, gatewayURL = 'https://uat.gateway.aventus.io') {
    this.freshnessWindow = freshnessWindow;
    const verificationKeyURL = `${gatewayURL}/verification/webhooks/signer-sha256-public`;
    try {
      const response = await axios.get(verificationKeyURL);
      this.publicKeyPEM = response.data.publicKeyPEM;
    } catch (error) {
      throw new Error(`Error fetching verification key: ${error}`);
    }
  }

  verifyEvent(request) {
    const { body: data, headers } = request;
    const id = headers['x-avn-event-id'];
    const signature = headers['x-avn-event-signature'];
    const freshness = headers['x-avn-event-freshness'] || 0;

    if (Date.now() > new Date(freshness).getTime() + this.freshnessWindow) {
      throw new Error(`Reason: Freshness, Request ID: ${data.requestId}, event: ${data.event}`);
    }

    const message = Buffer.from(JSON.stringify({ id, freshness, data }));

    if (!crypto.verify('SHA256', message, this.publicKeyPEM, Buffer.from(signature, 'base64'))) {
      throw new Error(`Reason: Signature, Request ID: ${data.requestId}, event: ${data.event}`);
    }

    return data;
  }
}

module.exports = Verifier;
