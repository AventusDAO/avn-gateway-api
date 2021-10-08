const { LambdaClient, UpdateFunctionCodeCommand } = require('@aws-sdk/client-lambda');
const aws = new LambdaClient({ region: 'eu-west-2'});
const zipdir = require('zip-dir');
const fs = require('fs');
const resolve = require('path').resolve;
const join = require('path').join;
const { spawn } = require('child-process-async');
const os = require('os');

const LAMBDAS = [
  'poll-handler',
  'query-handler',
  'send-handler',
  'authorisation-handler',
];

async function publish(lambda) {
  console.log('Publishing', lambda, 'to AWS...');
  const params = { ZipFile: await zipdir(lambda), FunctionName: lambda };

  try {
    const data = await aws.send(new UpdateFunctionCodeCommand(params));
    console.log('Published', lambda);
  } catch (err) {
    console.log(lambda, '- Error:', err);
  }
}

async function updateNodeModulesAndPublish(lambda) {
  console.log('Updating node modules for', lambda + '...' );

  const paths = {
    lambda: join(__dirname, lambda),
    lambdaPkg: join(__dirname, lambda, 'package.json'),
    common: join(__dirname, 'common'),
    lambdaIdx: join(__dirname, lambda, 'index.js'),
    commonPkg: join(__dirname, 'common', 'package.json')
  }

  // Parse any common files required by lambda index.js
  const commonFiles = fs.readFileSync(paths.lambdaIdx, 'utf8').match(/(?<=require\('..\/common\/).*?(?='\))/gs) || [];

  // If common files have been used add their dependecies
  if (commonFiles.length > 0) {
    // Get the common package.json and the lambda package.json
    const commonPkg = require(paths.commonPkg);
    const lambdaPkg = require(paths.lambdaPkg);

    // Add the common dependencies to the lambda package.json
    Object.entries(commonPkg.dependencies).forEach(([module, version] = dependency) => lambdaPkg.dependencies[module] = version);
    fs.writeFileSync(paths.lambdaPkg, JSON.stringify(lambdaPkg, null, 2));
  }

  // Update the lambda node modules
  const npmCmd = os.platform().startsWith('win') ? 'npm.cmd' : 'npm';
  const child = spawn(npmCmd, ['i'], {env: process.env, cwd: paths.lambda, stdio: 'ignore'});
  await child.on('exit', () => {console.log('Node modules for', lambda, 'updated')});

  // Copy any required common files into the lambda and re-reference them in its index.js
  commonFiles.forEach(file => {
    fs.copyFileSync(join(paths.common, file), join(paths.lambda, file))
    replaceRef(paths.lambdaIdx, '../common/'+file, './'+file);
  });

  // Publish the lambda to AWS
  await publish(lambda);

  // Remove any  copied common files from the lambda and dereference them in index.js
  commonFiles.forEach(file => {
    fs.unlinkSync(join(paths.lambda, file));
    replaceRef(paths.lambdaIdx, './'+file, '../common/'+file);
  });
}

function replaceRef(file, a, b) {
  fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(a, b), 'utf8');
}

async function main() {
  const lambda = process.argv[2];
  if (lambda === undefined) {
    LAMBDAS.forEach(lambda => updateNodeModulesAndPublish(lambda));
  } else if (LAMBDAS.includes(lambda)) {
    updateNodeModulesAndPublish(lambda);
  } else {
    console.log('Error: no such lambda');
  }
};

if (require.main === module) main();
