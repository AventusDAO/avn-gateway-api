const AvnApi = require('../index.js');
const assert = require('chai').assert;
const BN = require('bn.js');
const GATEWAY = 'https://4ayax6s3pg.execute-api.eu-west-1.amazonaws.com';
const TOKEN = '0x14fa2f8fadb0acec171d1d2d3aef4e4b9f4814e5';
const AVT_SUPPLY = '105098505078338785032490';

const ACCOUNTS = {
  relayer: {
    seed: '0xa343da434e14c8cef7c474551a63e7e4c0cb4670a2374368ee01e670ab0d2464',
    address: '5FbUQ2kJWLoqHuSTSNNqBwKwdQnBVe4HF3TeGyu6UoZaryTh',
    publicKey: '0x9c2bfffc466eb9c1bad0d8393df93770468ee54b0a0f05232e4b5dde6960b004'
  },
  sender: { // process.env.SURI account
    mnemonic: 'rapid pet capable tooth wisdom utility child luggage never toddler gather sea',
    seed: '0x3eee10b8d28ea5a8fb165174022d637a8ec4b632c1e66472b234683a159bf6dd',
    address: '5GLVUNb9oKLesAjDt17X1N49xyp2fr62sKPAKLgmmNbDB9MH',
    publicKey: '0xbcfb2baf67c7553a9fa39d3526f697dcf84165fbef074378ec8d5d68384d7749'
  },
  user1: {
    mnemonic: 'cabbage bone maid dentist sniff load shaft portion flavor gym shine debris',
    seed: '0x079306effc5d804326b4740ef12da0d126a993d31eaff519ac6d183a4a4e652a',
    address: '5DAgxVxKmnJ7hfhDEB9UetZm4jR2MPjGZGrmJZjirSVJDdMr',
    publicKey: '0x30ccad92fa31a27621c5fdf872c0244d92b0211662c5bce869d93edf79120f2e'
  },
  user2: {
    mnemonic: 'skate almost song wood lake giant stomach pupil know ugly check image',
    seed: '0x197bcdc6a4f99683346ada29b1ec2beb62aafffff487a55070a9c9e13d36d86a',
    address: '5FgyNN84CzQfwHBUJWvQkr36hiQYEXjDhcUYVx9tCTdgqosF',
    publicKey: '0xa05dc0c30b73e2d3f3d3542c2389adb40e96f87233c2f93d06a46973dd1c3972'
  },
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
  return assert.equal(new BN(a).toString(), new BN(b).toString());
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
