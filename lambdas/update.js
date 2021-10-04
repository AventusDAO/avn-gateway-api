const { LambdaClient, UpdateFunctionCodeCommand } = require('@aws-sdk/client-lambda');
const aws = new LambdaClient({ region: 'eu-west-2'});
var zipdir = require('zip-dir');

const LAMBDAS = [
  'example',
  'poll-handler',
  'query-handler',
  'send-handler',
  'authorisation-handler',
];

async function uploadLambda(lambda) {
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