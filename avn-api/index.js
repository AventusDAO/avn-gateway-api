const version = require('./package.json').version;
const Query = require('./lib/query.js');
const Send = require('./lib/send.js');
const Poll = require('./lib/poll.js');

const AvnApi = function AvnApi(gateway) {
  let id = 1;
  this.id = () => id++;
  this.gateway = gateway;
  this.version = version;
  this.query = new Query(gateway, this.id);
  this.send = new Send(gateway, this.id);
  this.poll = new Poll(gateway, this.id);
};


module.exports = AvnApi;