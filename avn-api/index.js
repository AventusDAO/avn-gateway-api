const version = require('./package.json').version;
const Query = require('./lib/query.js');
const Send = require('./lib/send.js');
const Poll = require('./lib/poll.js');

function AvnApi(gateway, id) {
  this.id = id || 1;
  this.gateway = gateway;
  this.version = version;
  const avnApi = {
    gateway : this.gateway,
    nextId : () => this.id++
  };
  this.query = new Query(avnApi);
  this.send = new Send(avnApi);
  this.poll = new Poll(avnApi);
};

module.exports = AvnApi;