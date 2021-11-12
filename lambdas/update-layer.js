#!/usr/bin/env node

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

const LAMBDAS = [
  'poll-handler',
  'query-handler',
  'send-handler',
  'authorisation-handler',
  'tx-status-update-handler'
]

async function main() {
  const paths = {
    layerPath: join(__dirname, 'layer'),
    layerNodejsPath: join(__dirname, 'layer/nodejs')
  }
  const layerName = 'common-layer'
  await installNpmModules(layerName, paths.layerNodejsPath)
  const { LayerVersionArn } = await createLambdaLayer(layerName, paths.layerPath)
  await updateLambdaFunctionAssociatedLayer(LayerVersionArn)
}

async function updateLambdaFunctionAssociatedLayer(layerVersionArn) {
  await Promise.all(LAMBDAS.map(async (lambda) => {
    await publishLambdaLayer(lambda, `${lambda} - Update layer deployment`, [layerVersionArn])
  }))
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
  installNpmModules,
  createLambdaLayer,
  publishLambdaLayer
}