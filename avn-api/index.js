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
  this.setSURI = suri => setSURI(suri, this.options, Awt);
  this.awt = Awt;
  this.proxy = Proxy;
  this.utils = Utils;

  // TODO: do we want to allow changing SURI on the fly?
  const getSuri = () => this.options.suri ? this.options.suri : process.env.AVN_SURI;
  if (!getSuri()) throw new Error('Suri is not defined');

  this.signer = () => Utils.getSigner(getSuri());
  this.myAddress = () => this.signer().address;
  this.myPublicKey = () => Utils.convertToPublicKeyIfNeeded(this.myAddress());

  if (this.gateway) {
    awtToken = Awt.generateAwtToken(getSuri(), this.options);

    const avnApi = {
      gateway: this.gateway,
      signer: () => this.signer(),
      uuid: () => uuidv4(),
      axios: () => setupAxios(Awt, getSuri())
    };

    this.query = new Query(avnApi);
    this.send = new Send(avnApi, this.query);
    this.poll = new Poll(avnApi);
  }
};

function setupAxios(awtTokenManager, suri) {
  if (!awtTokenManager.tokenAgeIsValid(this.awtToken)) {
    console.log(' - Awt token has expired, refreshing');
    this.awtToken = awtTokenManager.generateAwtToken(suri);
  }

  // Add any middlewares here to configure global axios behaviours
  Axios.defaults.headers.common = { Authorization: `bearer ${this.awtToken}` };
  return Axios;
}

function setSURI(suri, options, awtTokenManager) {
  options.suri = suri;

  this.awtToken = awtTokenManager.generateAwtToken(suri);
  console.info(" - Suri updated");
}

module.exports = AvnApi;
