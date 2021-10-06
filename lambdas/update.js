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
  const params = {
    ZipFile: await zipdir(lambda),
    FunctionName: lambda,
  };

  try {
    const data = await aws.send(new UpdateFunctionCodeCommand(params));
    console.log(lambda, 'updated successfully');
  } catch (err) {
    console.log(lambda, '- Error:', err);
  }
}

async function updateNodeModulesAndPublish(lambda) {
  const paths = {
    lambda: join(__dirname, lambda),
    lambdaPackageJSON: join(__dirname, lambda, 'package.json'),
    lambdaCommonJS: join(__dirname, lambda, 'common.js'),
    lambdaIndexJS: join(__dirname, lambda, 'index.js'),
    commonPackageJSON: join(__dirname, 'package.json')
  }

  // Get all the modules used in common.js
  const commonModules = fs.readFileSync('common.js', 'utf8').match(/(?<=require\(').*?(?='\);)/gs);

  // Get the common package.json and the lambda's package.json
  const commonPackageJSON = require(paths.commonPackageJSON);
  const lambdaPackageJSON = require(paths.lambdaPackageJSON);

  // Add common's dependencies to the lambda's package.json
  commonModules.forEach(module => lambdaPackageJSON.dependencies[module] = commonPackageJSON.dependencies[module]);
  fs.writeFileSync(paths.lambdaPackageJSON, JSON.stringify(lambdaPackageJSON, null, 2));

  // Run npm install on the lambda
  const npmCmd = os.platform().startsWith('win') ? 'npm.cmd' : 'npm';
  const child = spawn(npmCmd, ['i'], {env: process.env, cwd: paths.lambda, stdio: 'inherit'});

  // Once the modules are updated, copy common.js to the lambda, reference it, and publish
  child.on('exit', async () => {
    fs.copyFileSync('common.js', paths.lambdaCommonJS);
    replaceRef(paths.lambdaIndexJS, '../common.js', './common.js');
    await publish(lambda);
    fs.unlinkSync(paths.lambdaCommonJS);
    replaceRef(paths.lambdaIndexJS, './common.js', '../common.js');
  })
}

function replaceRef(file, a, b) {
  fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(a, b), 'utf8');
}

async function main() {
  const lambda = process.argv[2];

  if (lambda === undefined) {
    LAMBDAS.forEach(async lambda => await updateNodeModulesAndPublish(lambda));
  } else if (LAMBDAS.includes(lambda)) {
    updateNodeModulesAndPublish(lambda);
  } else {
    console.log('Error: no such lambda');
  }
};

if (require.main === module) main();