'use strict';

const amqp = require('amqplib/callback_api');
const SecretsManager = require('./secretsManager.js');

module.exports = MQSender;

function MQSender(secretsManagerRegion, secretArn, mqBrokerAmqpEndpoint) {
  this.secretsManager = new SecretsManager(secretsManagerRegion, console);
  this.secretArn = secretArn;
  this.mqBrokerAmqpEndpoint = mqBrokerAmqpEndpoint;
}

MQSender.prototype.getMqConnectionUrl = async function () {
  const secret = await this.secretsManager.getSecret(this.secretArn);
  const protocolSeparator = '://';
  let protocol = process.env.MQ_PROTOCOL;

  // check if the endpoint contains the protocol. We support amqp or amqps
  if (
    this.mqBrokerAmqpEndpoint.toLowerCase().startsWith('amqp' + protocolSeparator) ||
    this.mqBrokerAmqpEndpoint.toLowerCase().startsWith('amqps' + protocolSeparator)
  ) {
    const protocolSeparatorIndex = this.mqBrokerAmqpEndpoint.indexOf(protocolSeparator);
    const extractedProtocolFromEndpoint = this.mqBrokerAmqpEndpoint.substring(0, protocolSeparatorIndex);

    if (protocol) {
      // make sure the protocol specified matches the one that is part of the endpoint
      if (protocol !== extractedProtocolFromEndpoint) {
        throw new Error(
          `Protocol specified in env variable (${protocol}) is different to the one found on the endpoint (${extractedProtocolFromEndpoint})`
        );
      }
    } else {
      // Set the protocol by taking it from the endpoint
      protocol = extractedProtocolFromEndpoint;
    }

    // remove the protocol and the separator from the endpoint
    this.mqBrokerAmqpEndpoint = this.mqBrokerAmqpEndpoint.substring(protocolSeparatorIndex + protocolSeparator.length);
  }

  const rabbitEndpointPrefix = `${protocol}://${encodeURIComponent(secret.username)}:${encodeURIComponent(secret.password)}@`;
  return rabbitEndpointPrefix.concat(this.mqBrokerAmqpEndpoint);
};

MQSender.prototype.sendMessageToMQ = async function (queue, amqpChannel, message, persistent = true) {
  return await new Promise((resolve, reject) => {
    try {
      amqpChannel.checkQueue(queue, function (err, ok) {
        if (err) throw Error(`queue '${queue}' does not exist`);
        if (ok) {
          amqpChannel.sendToQueue(queue, Buffer.from(JSON.stringify(message)), {
            persistent: persistent
          });
          console.info('Sent %s to %s', JSON.stringify(message), queue);
          resolve(message.requestId);
        }
      });
    } catch (e) {
      reject(e.message);
    }
  });
};

MQSender.prototype.openChannel = async function () {
  return await createChannel(this.amqpConnection);
}

MQSender.prototype.connectToMessageBroker = async function () {
  const url = await this.getMqConnectionUrl();
  let self = this;
  await new Promise((resolve, reject) => {
    amqp.connect(url, function (err, conn) {
      console.info('[AMQP] connecting');

      if (err) {
        console.error('[AMQP] connect error', err.message);
        self.amqpConnected = false;
        reject();
      }

      conn.on('error', function (err) {
        console.error('[AMQP] connection error', err.message);
        self.amqpConnected = false;
        reject();
      });

      conn.on('close', function () {
        console.error('[AMQP] connection closed');
        self.amqpConnected = false;
        reject();
      });

      console.info('[AMQP] connected');
      self.amqpConnected = true;
      self.amqpConnection = conn;
      resolve();
    });
  });
};

function createChannel(conn) {
  return new Promise((resolve, reject) => {
    conn.createChannel(function (err, channel) {
      if (err) {
        console.error('[AMQP] channel connection error', err.message);
        throw err;
      }

      channel.on('error', function (err) {
        console.error('[AMQP] channel error', err.message);
      });

      channel.on('close', function () {
        console.info('[AMQP] channel closed');
      });

      console.info('[AMQP] channel created');

      resolve(channel);
    });
  });
}
