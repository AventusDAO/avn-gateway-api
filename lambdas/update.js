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

function addFilesFromDirectoryToZip (lambdaDir) {
  const zip = new JSZip();
  const dirContents = fs.readdirSync(lambdaDir, { withFileTypes: true });

  dirContents.forEach(({name}) => {
    const path = `${lambdaDir}/${name}`;

    if (fs.statSync(path).isFile()) {
      zip.file(path, fs.readFileSync(path, 'utf-8'));
    }

    if (fs.statSync(path).isDirectory()) {
      addFilesFromDirectoryToZip(path, zip);
    }
  });

  return zip;
};

async function zipAndUploadLambda(lambda) {
  const lambdaDir = path.join(lambda);
  const zipPath = path.join(lambdaDir, lambda + '.zip');

  if (fs.existsSync(zipPath)) {
    fs.unlinkSync(zipPath);
  }

  const zip = addFilesFromDirectoryToZip(lambdaDir);

  const params = {
    ZipFile: await zip.generateAsync({ type: 'nodebuffer' }),
    FunctionName: lambda,
  };

  try {
    const data = await aws.send(new UpdateFunctionCodeCommand(params));
    console.log(lambda, 'updated successfully');
  } catch (err) {
    console.log(lambda, '- error', err);
  }
}

async function main() {
  const target = process.argv[2];
  if (target === 'all') {
    LAMBDAS.forEach(async lambda => await zipAndUploadLambda(lambda));
  } else {
    await zipAndUploadLambda(target);
  }
};

if (require.main === module) main();
