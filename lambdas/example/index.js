const figlet = require('figlet');
const exampleJSON = require('./example.json');

async function getExampleMessage() {
  return new Promise((resolve, reject) => {
    figlet(exampleJSON.message, (err, data) => {
      if (err) {
        return reject(err);
      }
      return resolve(data);
    });
  });
}

exports.handler = async (event) => {
  const response = {
    statusCode: 200,
    body: await getExampleMessage()
  };
  return response;
};

// async function testlocal() {
//   console.log(await getExampleMessage());
// }
//
// testlocal();