const { cryptoWaitReady } = require('@polkadot/util-crypto');
const axios = require('axios');
const version = require('./package.json').version;
const Query = require('./lib/query.js');
const Send = require('./lib/send.js');
const Poll = require('./lib/poll.js');
const Awt = require('./lib/awt.js');

function AvnApi(gateway, id) {
  this.id = id || 1;
  this.gateway = gateway;
  this.version = version;
};

AvnApi.prototype.init = async function () {
  await cryptoWaitReady();

  const axios = await setupAxios();

  const avnApi = {
    gateway : this.gateway,
    nextId : () => this.id++,
    axios,
  };

  this.query = new Query(avnApi);
  this.send = new Send(avnApi);
  this.poll = new Poll(avnApi);
  this.awt = Awt;
}

async function setupAxios() {
  const awtToken = Awt.generateAwtToken(process.env.SURI);
  // Add any middlewares here to configure global axios behaviours
  axios.defaults.headers.common = {'Authorization': `bearer ${awtToken}`};

  return axios;
}

module.exports = AvnApi;