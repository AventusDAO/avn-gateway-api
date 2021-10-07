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
    lambdaPkgJson: join(__dirname, lambda, 'package.json'),
    common: join(__dirname, 'common'),
    lambdaIndexJS: join(__dirname, lambda, 'index.js'),
    commonPkgJson: join(__dirname, 'common', 'package.json')
  }

  // Get the common package.json and the lambda's package.json
  const commonPkgJson = require(paths.commonPkgJson);
  const lambdaPkgJson = require(paths.lambdaPkgJson);

  // Add common.js's dependencies to the lambda's package.json
  Object.entries(commonPkgJson.dependencies).forEach(dependency => lambdaPkgJson.dependencies[dependency[0]] = dependency[1]);
  fs.writeFileSync(paths.lambdaPkgJson, JSON.stringify(lambdaPkgJson, null, 2));

  // Run npm install on the lambda
  const npmCmd = os.platform().startsWith('win') ? 'npm.cmd' : 'npm';
  const child = spawn(npmCmd, ['i'], {env: process.env, cwd: paths.lambda, stdio: 'inherit'});

  // Once modules are updated, copy common files into lambda, reference in index.js, publish lambda, and revert to local setup
  child.on('exit', async () => {
    // Get all the common files used in the lambda
    const commonFiles = fs.readFileSync(paths.lambdaIndexJS, 'utf8').match(/(?<=require\('..\/common\/).*?(?='\))/gs) || [];
    commonFiles.forEach(file => fs.copyFileSync(join(paths.common, file), paths.lambda));
    // replaceRef(paths.lambdaIndexJS, '../common', '.');
    // await publish(lambda);
    // fs.unlinkSync(paths.common);
    // replaceRef(paths.lambdaIndexJS, './common.js', '../common');
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