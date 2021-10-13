const AvnApi = require('../index.js');
const assert = require('chai').assert;
const BN = require('bn.js');
const GATEWAY = 'https://n67ibi1ujh.execute-api.eu-west-2.amazonaws.com';
const TOKEN = '0x14fa2f8fadb0acec171d1d2d3aef4e4b9f4814e5';
const AVT_SUPPLY = '5100000000000000000000';

const ACCOUNTS = {
  relayer: {
    address: '5FbUQ2kJWLoqHuSTSNNqBwKwdQnBVe4HF3TeGyu6UoZaryTh',
    publicKey: '0x9c2bfffc466eb9c1bad0d8393df93770468ee54b0a0f05232e4b5dde6960b004'
  },
  user1: {
    address: '5GLVUNb9oKLesAjDt17X1N49xyp2fr62sKPAKLgmmNbDB9MH',
    publicKey: '0xbcfb2baf67c7553a9fa39d3526f697dcf84165fbef074378ec8d5d68384d7749'
  },
  user2: {
    address: '5DAgxVxKmnJ7hfhDEB9UetZm4jR2MPjGZGrmJZjirSVJDdMr',
    publicKey: '0x30ccad92fa31a27621c5fdf872c0244d92b0211662c5bce869d93edf79120f2e'
  },
  sender: {
    mnemonic: 'skate almost song wood lake giant stomach pupil know ugly check image',
    seed: '0x197bcdc6a4f99683346ada29b1ec2beb62aafffff487a55070a9c9e13d36d86a',
    address: '5FgyNN84CzQfwHBUJWvQkr36hiQYEXjDhcUYVx9tCTdgqosF'
  }
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function avnApi() {
  const api = new AvnApi(GATEWAY);
  await api.init();
  return api;
}

function bnEquals(a,b) {
  return assert.equal(new BN(a).toString(), new BN(a).toString());
}

// keep alphabetical
module.exports = {
  ACCOUNTS,
  AVT_SUPPLY,
  avnApi,
  BN,
  bnEquals,
  sleep,
  TOKEN,
}
