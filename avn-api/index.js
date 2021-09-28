const version = require('./package.json').version;
const Query = require('./lib/query.js');
const Send = require('./lib/send.js');

const AvnApi = function AvnApi(gateway) {
  this.gateway = gateway;
  this.version = version;
  this.query = new Query(gateway);
  this.send = new Send(gateway);
};

module.exports = AvnApi;