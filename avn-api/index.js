const { cryptoWaitReady } = require('@polkadot/util-crypto');
const { v4: uuidv4 } = require('uuid');
const Axios = require('axios');
const Query = require('./lib/query.js');
const Send = require('./lib/send.js');
const Poll = require('./lib/poll.js');
const Proxy = require('./lib/proxy.js');
const Awt = require('./lib/awt.js');
const Utils = require('./lib/utils.js');
const version = require('./package.json').version;

function AvnApi(gateway, options) {
  this.version = version;
  this.awtToken;
  if (gateway) this.gateway = gateway;
  this.options = options || {};
}

AvnApi.prototype.init = async function () {
  await cryptoWaitReady();
  this.setSURI = suri => {
    this.options.suri = suri;
    this.awtToken = this.gateway ? Awt.generateAwtToken(this.options) : undefined;
    console.info(" - Suri updated");
  }

  this.awt = Awt;
  this.proxy = Proxy;
  this.utils = Utils;

  // TODO: do we want to allow changing SURI on the fly?
  const getSuri = () => {
    if (!this.options.suri && process.env.AVN_SURI) {
        this.options.suri = process.env.AVN_SURI;
    }

    return this.options.suri;
  };

  if (!getSuri()) throw new Error('Suri is not defined');

  this.signer = () => Utils.getSigner(getSuri());
  this.myAddress = () => this.signer().address;
  this.myPublicKey = () => Utils.convertToPublicKeyIfNeeded(this.myAddress());

  if (this.gateway) {
    this.awtToken = Awt.generateAwtToken(this.options);

    const avnApi = {
      gateway: this.gateway,
      signer: () => this.signer(),
      uuid: () => uuidv4(),
      axios: () => setupAxios(Awt, this.options, this.awtToken)
    };

    this.query = new Query(avnApi);
    this.send = new Send(avnApi, this.query);
    this.poll = new Poll(avnApi);
  }
};

function setupAxios(awtTokenManager, options, awtToken) {
  if (!awtTokenManager.tokenAgeIsValid(awtToken)) {
    console.log(' - Awt token has expired, refreshing');
    awtToken = awtTokenManager.generateAwtToken(options);
  }

  // Add any middlewares here to configure global axios behaviours
  Axios.defaults.headers.common = { Authorization: `bearer ${awtToken}` };
  return Axios;
}


module.exports = AvnApi;
