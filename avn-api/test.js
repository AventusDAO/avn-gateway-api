const AvnApi = require('./index.js')

async function main() {
  const api = new AvnApi('https://n67ibi1ujh.execute-api.eu-west-2.amazonaws.com');
  console.log('Version:', api.version);
  console.log('Total AVT:', await api.query.getTotalAvt());
  console.log('User AVT balance:', await api.query.getAvtBalance('5GLVUNb9oKLesAjDt17X1N49xyp2fr62sKPAKLgmmNbDB9MH'));
  console.log('User token balance:', await api.query.getTokenBalance('5DAgxVxKmnJ7hfhDEB9UetZm4jR2MPjGZGrmJZjirSVJDdMr', '0x2adce7ada36d86253aa63bcf4aad9f84ccb9480e'));
  console.log('User account nonce:', await api.query.getAccountNonce('5GLVUNb9oKLesAjDt17X1N49xyp2fr62sKPAKLgmmNbDB9MH'));
  console.log('Expect error:', await api.query.getAccountNonce('0000'));
}

if (require.main === module) main();