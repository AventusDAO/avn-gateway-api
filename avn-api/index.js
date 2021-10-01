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
};

AvnApi.prototype.init = async function () {
  const awt = await Awt.init();
  const axios = setupAxios(awt);

  const avnApi = {
    gateway : this.gateway,
    nextId : () => this.id++,
    axios: axios
  };

  this.query = new Query(avnApi);
  this.send = new Send(avnApi);
  this.poll = new Poll(avnApi);
  this.awt = awt;
}

function setupAxios(awt) {
  const awtToken = awt.generateAwtToken(process.env.SURI);
  // Add any middlewares here to configure global axios behaviours
  Axios.defaults.headers.common = {'Authorization': `bearer ${awtToken}`};

  return Axios;
}

module.exports = AvnApi;