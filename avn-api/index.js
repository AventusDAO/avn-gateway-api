const version = require('./package.json').version;
const Query = require('./lib/query.js');

const AvnApi = function AvnApi(gateway) {
  this.version = version;
  this.query = new Query(gateway);
};

AvnApi.version = version;

module.exports = AvnApi;