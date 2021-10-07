const { LambdaClient, UpdateFunctionCodeCommand } = require('@aws-sdk/client-lambda');
const aws = new LambdaClient({ region: 'eu-west-2'});
const zipdir = require('zip-dir');
const fs = require('fs');
const resolve = require('path').resolve;
const join = require('path').join;
const { spawn } = require('child_process');
const os = require('os');

const LAMBDAS = [
  'poll-handler',
  'query-handler',
  'send-handler',
  'authorisation-handler',
];

async function publish(lambda) {
  console.log('Publishing', lambda, 'to AWS...');

  const params = {
    ZipFile: await zipdir(lambda),
    FunctionName: lambda,
  };

  try {
    const data = await aws.send(new UpdateFunctionCodeCommand(params));
  } catch (err) {
    console.log(lambda, '- Error:', err);
  }
}

async function prepareAndPublish(lambda) {
  console.log('Preparing', lambda + '...' );

  const paths = {
    lambda: join(__dirname, lambda),
    lambdaPkgJson: join(__dirname, lambda, 'package.json'),
    common: join(__dirname, 'common'),
    lambdaIndexJS: join(__dirname, lambda, 'index.js'),
    commonPkgJson: join(__dirname, 'common', 'package.json')
  }

  // Get the common package.json and the lambda package.json
  const commonPkgJson = require(paths.commonPkgJson);
  const lambdaPkgJson = require(paths.lambdaPkgJson);

  // Add the common dependencies to the lambda package.json
  Object.entries(commonPkgJson.dependencies).forEach(dependency => lambdaPkgJson.dependencies[dependency[0]] = dependency[1]);
  fs.writeFileSync(paths.lambdaPkgJson, JSON.stringify(lambdaPkgJson, null, 2));

  // Run npm install on the lambda to pudate the node modules
  const npmCmd = os.platform().startsWith('win') ? 'npm.cmd' : 'npm';
  const child = spawn(npmCmd, ['i'], {env: process.env, cwd: paths.lambda, stdio: 'ignore'});

  // Once the node modules are updated:
  child.on('exit', async () => {
    // Parse any common files required by index.js
    const commonFiles = fs.readFileSync(paths.lambdaIndexJS, 'utf8').match(/(?<=require\('..\/common\/).*?(?='\))/gs) || [];

    // Copy them into the lambda and re-reference them in index.js
    commonFiles.forEach(file => {
      fs.copyFileSync(join(paths.common, file), join(paths.lambda, file))
      replaceRef(paths.lambdaIndexJS, '../common/'+file, './'+file);
    });

    // Publish the lambda to AWS
    await publish(lambda);

    // Remove the common files from the lambda and dereference them in index.js
    commonFiles.forEach(file => {
      fs.unlinkSync(join(paths.lambda, file));
      replaceRef(paths.lambdaIndexJS, './'+file, '../common/'+file);
    });
  })
}

function replaceRef(file, a, b) {
  fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(a, b), 'utf8');
}

async function main() {
  const lambda = process.argv[2];

  if (lambda === undefined) {
    LAMBDAS.forEach(async lambda => await prepareAndPublish(lambda));
  } else if (LAMBDAS.includes(lambda)) {
    await prepareAndPublish(lambda);
  } else {
    console.log('Error: no such lambda');
  }
};

if (require.main === module) main();
