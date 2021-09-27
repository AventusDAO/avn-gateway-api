const version = require('./package.json').version;
const Query = require('./lib/query.js');
const Send = require('./lib/send.js');
const Poll = require('./lib/poll.js');

const AvnApi = function AvnApi(gateway) {
  this.gateway = gateway;
  this.version = version;
  this.query = new Query(gateway);
  this.send = new Send(gateway);
  this.poll = new Poll(gateway);
};

module.exports = AvnApi;