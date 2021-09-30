const version = require('./package.json').version;
const Query = require('./lib/query.js');
const Send = require('./lib/send.js');
const Poll = require('./lib/poll.js');

function AvnApi(gateway, id) {
  this.id = id || 1;
  this.gateway = gateway;
  this.version = version;
  this.query = new Query(gateway, () => this.id++);
  this.send = new Send(gateway, () => this.id++);
  this.poll = new Poll(gateway, () => this.id++);
};

module.exports = AvnApi;