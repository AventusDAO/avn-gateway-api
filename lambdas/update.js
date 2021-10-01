const { LambdaClient, UpdateFunctionCodeCommand } = require('@aws-sdk/client-lambda');
const JSZip = require('jszip');
const path = require('path');
const fs = require('fs');
const aws = new LambdaClient({ region: 'eu-west-2'});

const LAMBDAS = [
  'example',
  'poll-handler',
  'query-handler',
  'send-handler'
];

function zipLambda(lambda) {
  const zip = new JSZip();
  const contents = fs.readdirSync(lambda, { withFileTypes: true });

  contents.forEach(({name}) => {
    const path = `${lambda}/${name}`;

    if (fs.statSync(path).isFile()) {
      zip.file(path, fs.readFileSync(path, 'utf-8'));
    }

    if (fs.statSync(path).isDirectory()) {
      zipLambda(path, zip);
    }
  });

  return zip;
};

async function uploadLambda(lambda) {
  const params = {
    ZipFile: await zipLambda(lambda).generateAsync({ type: 'nodebuffer' }),
    FunctionName: lambda,
  };

  try {
    const data = await aws.send(new UpdateFunctionCodeCommand(params));
    console.log(lambda, 'updated successfully');
  } catch (err) {
    console.log(lambda, '- Error:', err);
  }
}

async function main() {
  const lambda = process.argv[2];

  if (lambda === undefined) {
    LAMBDAS.forEach(async lambda => await uploadLambda(lambda));
  } else if (LAMBDAS.includes(lambda)) {
    await uploadLambda(lambda);
  } else {
    console.log('Error: no such lambda');
  }
};

if (require.main === module) main();
