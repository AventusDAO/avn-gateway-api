/*
  Description:
    This script publishes any changes made within the lambda function folder to the corresponding AWS lambda function.

    It contains the following steps:
      1. Clean up node modules in a lambda function, remove any dependencies already defined in the layer folder.
      2. Install all lambda function dependencies defined in the package.json file within lambda function folder
      3. Compress all files within the lambda function folder into a zip file and publish it to the AWS lambda function
      4. Attach or update the lambda layer to the latest version if it is required by the lambda function files.

    Note:
      * If there are changes also made in the layer folder, please run update-layer.js first
      * In order to use the testlocal function at the end of each lambda function's index.js file, please run update-local.js before executing the local test
*/

const {
  LambdaClient,
  GetFunctionCommand,
  ListLayersCommand,
  UpdateFunctionCodeCommand
} = require('@aws-sdk/client-lambda')
const aws = new LambdaClient({ region: 'eu-west-1' })
const fs = require('fs')
const { join } = require('path')
const zipdir = require('zip-dir')
const { LAYER_NAME, createLambdaLayer, publishLambdaLayer } = require('./update-layer.js')
const { installPkgDependencies, getAllFilesPaths } = require('./utils.js')

const LAMBDAS = ['poll-handler', 'query-handler', 'send-handler', 'authorisation-handler', 'tx-status-update-handler']

async function main() {
  const lambda = process.argv[2]
  const lambdas = lambda === 'all' ? LAMBDAS : [lambda]
  await Promise.allSettled(
    lambdas.map(lambda => {
      updateNodeModulesAndPublish(lambda)
    })
  )
}

async function updateNodeModulesAndPublish(lambda) {
  try {
    if (!LAMBDAS.includes(lambda)) throw Error('no such lambda', lambda)

    const paths = {
      lambda: join(__dirname, lambda),
      lambdaIdx: join(__dirname, lambda, 'index.js'),
      lambdaPkg: join(__dirname, lambda, 'package.json'),
      layer: join(__dirname, 'layer'),
      layerPkg: join(__dirname, 'layer/nodejs/package.json')
    }

    if (!fs.existsSync(paths.lambda)) throw Error(`${lambda} source code is not found`)

    await updateNodeModules(lambda, paths)
    const lambdaFilesPaths = getAllFilesPaths(paths.lambda)
    const usesLambdaLayer = await updateRequirePathsInLambdaFiles(
      lambdaFilesPaths,
      /..\/layer\/nodejs\//gs,
      '/opt/nodejs/'
    )
    const layers = usesLambdaLayer ? await getLambdaLayer(LAYER_NAME, paths.layer) : null
    await publish(lambda, layers)
    await updateRequirePathsInLambdaFiles(lambdaFilesPaths, /\/opt\/nodejs\//gs, '../layer/nodejs/')

    console.log(`==== Lambda function ${lambda} is successfully published`)
  } catch (err) {
    console.log(`**** Failed to publish lambda function ${lambda} with error: ${err.message}`)
  }
}

async function updateNodeModules(lambda, paths) {
  let lambdaPkg = require(paths.lambdaPkg)
  if (lambdaPkg.dependencies) {
    const layerPkg = require(paths.layerPkg)
    Object.entries(layerPkg.dependencies).forEach(([module, _version] = dependency) => {
      if (lambdaPkg.dependencies[module]) delete lambdaPkg.dependencies[module]
    })
    fs.writeFileSync(paths.lambdaPkg, JSON.stringify(lambdaPkg, null, 2))
    await installPkgDependencies(lambda, paths.lambda)
  }
}

async function updateRequirePathsInLambdaFiles(lambdaFilesPaths, replaceRegEx, newPath) {
  let usesLambdaLayer = false
  await Promise.all(
    lambdaFilesPaths.map(async lambdaFilePath => {
      const fileBody = await fs.readFileSync(lambdaFilePath, 'utf8')
      const updatedFileBody = fileBody.replace(replaceRegEx, newPath)
      if (!usesLambdaLayer && updatedFileBody.includes(newPath)) usesLambdaLayer = true
      fs.writeFileSync(lambdaFilePath, updatedFileBody, 'utf8')
    })
  )
  return usesLambdaLayer
}

async function getLambdaLayer(layerName, layerPath) {
  layer = await aws.send(new ListLayersCommand({ LayerName: layerName }))
  if (layer.Layers.length > 0) {
    return [layer.Layers[0].LatestMatchingVersion.LayerVersionArn]
  } else {
    await installPkgDependencies(layerName, layerPath)
    const { LayerVersionArn } = await createLambdaLayer(layerName, layerPath)
    return [LayerVersionArn]
  }
}

async function publish(lambda, layers) {
  console.log('Publishing', lambda, 'to AWS...')
  const description = `${lambda} - Update script deployment`
  await publishLambdaLayer(lambda, description, layers)
  await publishSourceCode(lambda)
  console.log('Published', lambda)
}

async function publishSourceCode(lambda) {
  try {
    await aws.send(
      new UpdateFunctionCodeCommand({
        ZipFile: await zipdir(lambda),
        FunctionName: lambda
      })
    )
  } catch (err) {
    console.log(lambda, '- Error:', err)
  }
}

if (require.main === module) main()

module.exports = {
  LAMBDAS
}
