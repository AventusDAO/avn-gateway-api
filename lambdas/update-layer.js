/*
  Description:
    This script publish a new version of a lambda layer on AWS with the following steps:
      1. Install all dependencies declared in layer/nodejs/package.json file
      2. Create a new version of the lambda layer in AWS with a zip file contains all files within the lambdas/nodejs/ folder
*/

const {
  LambdaClient,
  PublishLayerVersionCommand,
  UpdateFunctionConfigurationCommand
} = require('@aws-sdk/client-lambda')
const aws = new LambdaClient({ region: 'eu-west-1' })
const join = require('path').join
const { spawn } = require('child-process-async')
const os = require('os')
const zipdir = require('zip-dir')

const LAYER_NAME = 'common-layer'

async function main() {
  try {
    const paths = {
      layerPath: join(__dirname, 'layer'),
      layerNodejsPath: join(__dirname, 'layer/nodejs')
    }
    await installNpmModules(LAYER_NAME, paths.layerNodejsPath)
    await createLambdaLayer(LAYER_NAME, paths.layerPath)
  } catch (err) {
    console.log('Updating lambda layer failed', err.message)
  }
}

async function publishLambdaLayer(lambda, description, layers) {
  try {
    await aws.send(new UpdateFunctionConfigurationCommand({
      FunctionName: lambda,
      Description: description,
      Layers: layers
    }))
  } catch (err) {
    console.log(lambda, '- Error:', err)
  }
}

async function installNpmModules(lambda, lambdaPath) {
  const npmCmd = os.platform().startsWith('win') ? 'npm.cmd' : 'npm'
  const child = spawn(npmCmd, ['i'], { env: process.env, cwd: lambdaPath, stdio: 'ignore' })
  await child.on('exit', () => {
    console.log('Node modules for', lambda, 'updated')
  })
}

async function createLambdaLayer(layerName, layerPath) {
  const response = await aws.send(new PublishLayerVersionCommand({
    LayerName: layerName,
    Content: { ZipFile: await zipdir(layerPath) }
  }))
  console.log(`Lambda layer ${layerName} is updated to version ${response.Version}`)
  return response
}

if (require.main === module) main()

module.exports = {
  LAYER_NAME,
  installNpmModules,
  createLambdaLayer,
  publishLambdaLayer
}