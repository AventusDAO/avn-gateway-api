const version = require('./package.json').version;
const Query = require('./lib/query.js');
const Send = require('./lib/send.js');
const Poll = require('./lib/poll.js');

const AvnApi = function AvnApi(gateway, _id) {
  let id = _id || 1;
  this.id = () => id;
  AvnApi.nextId = () => id++;
  this.gateway = gateway;
  this.version = version;
  this.query = new Query(gateway, AvnApi.nextId);
  this.send = new Send(gateway, AvnApi.nextId);
  this.poll = new Poll(gateway, AvnApi.nextId);
};


module.exports = AvnApi;