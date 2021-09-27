const version = require('./package.json').version;
const Query = require('./lib/query.js');

const AvnApi = function AvnApi(gateway) {
  this.gatweway = gateway;
  this.version = version;
  this.query = new Query(gateway);
};

module.exports = AvnApi;