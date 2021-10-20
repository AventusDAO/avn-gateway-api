const { cryptoWaitReady } = require('@polkadot/util-crypto');
const Axios = require('axios');
const version = require('./package.json').version;
const Query = require('./lib/query.js');
const Send = require('./lib/send.js');
const Poll = require('./lib/poll.js');
const Awt = require('./lib/awt.js');

function AvnApi(gateway, id) {
  this.id = id || 1;
  this.gateway = gateway;
  this.version = version;
  this.awtToken;
}

AvnApi.prototype.init = async function () {
  await cryptoWaitReady();

  const avnApi = {
    gateway : this.gateway,
    nextId : () => this.id++,
    axios: () => setupAxios(Awt)
  };

  this.query = new Query(avnApi);
  this.send = new Send(avnApi, this.query);
  this.poll = new Poll(avnApi);
  this.awt = Awt;
}

function setupAxios(awtTokenManager) {
  if (!awtTokenManager.tokenAgeIsValid(this.awtToken)) {
    console.log(" - Awt token has expired, refreshing")
    this.awtToken = awtTokenManager.generateAwtToken(process.env.SURI);
  }

  // Add any middlewares here to configure global axios behaviours
  Axios.defaults.headers.common = {'Authorization': `bearer ${this.awtToken}`};

  return Axios;
}

module.exports = AvnApi;