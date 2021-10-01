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

function addLambdaContentsToZip(lambdaDir) {
  const zip = new JSZip();
  const dirContents = fs.readdirSync(lambdaDir, { withFileTypes: true });

  dirContents.forEach(({name}) => {
    const path = `${lambdaDir}/${name}`;

    if (fs.statSync(path).isFile()) {
      zip.file(path, fs.readFileSync(path, 'utf-8'));
    }

    if (fs.statSync(path).isDirectory()) {
      addLambdaContentsToZip(path, zip);
    }
  });

  return zip;
};

async function uploadLambda(lambda) {
  const zip = addLambdaContentsToZip(lambda);

  const params = {
    ZipFile: await zip.generateAsync({ type: 'nodebuffer' }),
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
