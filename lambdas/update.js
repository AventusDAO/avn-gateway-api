/*
  Description:
    This script could update a lambda layer, a lambda function on AWS, and a lambda function to support local test
    And it can be executed as:
    
    `node update.js [target] [lambda_function]`

    target: layer
      publish a new version of a lambda layer on AWS with the following steps:
      1. Install all dependencies declared in layer/nodejs/package.json file
      2. Create a new version of the lambda layer in AWS with a zip file contains all files within the lambdas/nodejs/ folder

    target: lambda [all | lambda_function]
      publish all lambda functions or a single lambda function with the following steps:
      1. Clean up node modules in a lambda function, remove any dependencies already defined in the layer folder.
      2. Install all lambda function dependencies defined in the package.json file within lambda function folder
      3. Compress all files within the lambda function folder into a zip file and publish it to the AWS lambda function
      4. Attach or update the lambda layer to the latest version if it is required by the lambda function files.

    target: local [all | lambda_function]
      merges layer dependencies into all lambda function or a single lambda function's dependencies list, 
      and updates all layer file URIs from /opt/nodejs/ to ../layer/nodejs/ in lambda function files if there is any
*/

const {
  LambdaClient,
  ListLayersCommand,
  PublishLayerVersionCommand,
  UpdateFunctionConfigurationCommand,
  UpdateFunctionCodeCommand
} = require('@aws-sdk/client-lambda')
const aws = new LambdaClient({ region: 'eu-west-1' })
const fs = require('fs')
const { join } = require('path')
const zipdir = require('zip-dir')
const { replaceRef, mergePkgDependencies, installPkgDependencies, getAllFilesPaths } = require('./utils.js')

const TARGETS = ['layer', 'lambda', 'local']
const LAYER_NAME = 'common-layer'
const LAMBDAS = ['poll-handler', 'query-handler', 'send-handler', 'authorisation-handler', 'tx-status-update-handler']

async function main() {
  const target = process.argv[2]
  const lambda = process.argv[3]
  const lambdas = lambda === 'all' ? LAMBDAS : [lambda]

  switch (target) {
    case 'layer':
      try {
        const paths = {
          layerPath: join(__dirname, 'layer'),
          layerNodejsPath: join(__dirname, 'layer/nodejs')
        }
        await installPkgDependencies(LAYER_NAME, paths.layerNodejsPath)
        await createLambdaLayer(LAYER_NAME, paths.layerPath)
      } catch (err) {
        console.log('Updating lambda layer failed', err.message)
      }
      break
    case 'lambda':
      await Promise.allSettled(
        lambdas.map(lambda => {
          LAMBDAS.includes(lambda)
            ? updateNodeModulesAndPublish(lambda)
            : console.log('Error: no such lambda %s', lambda)
        })
      )
      break
    case 'local':
      await Promise.allSettled(
        lambdas.map(lambda => {
          LAMBDAS.includes(lambda) ? updateNodeModulesAndFiles(lambda) : console.log('Error: no such lambda %s', lambda)
        })
      )
      break
    default:
      console.log('target %s is not supported, please choose between %s', target, TARGETS.join(', '))
  }
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

async function publishLambdaLayer(lambda, description, layers) {
  try {
    await aws.send(
      new UpdateFunctionConfigurationCommand({
        FunctionName: lambda,
        Description: description,
        Layers: layers
      })
    )
  } catch (err) {
    console.log(lambda, '- Error:', err)
  }
}

async function createLambdaLayer(layerName, layerPath) {
  const response = await aws.send(
    new PublishLayerVersionCommand({
      LayerName: layerName,
      Content: { ZipFile: await zipdir(layerPath) }
    })
  )
  console.log(`Lambda layer ${layerName} is updated to version ${response.Version}`)
  return response
}

async function updateNodeModulesAndFiles(lambda) {
  const layerPkg = join(__dirname, 'layer/nodejs/package.json')
  const lambdaPkg = join(__dirname, lambda, 'package.json')
  mergePkgDependencies(layerPkg, lambdaPkg)

  const lambdaPath = join(__dirname, lambda)
  await installPkgDependencies(lambda, lambdaPath)

  const lambdaFilesPaths = getAllFilesPaths(lambdaPath)
  lambdaFilesPaths.forEach(filePath => {
    replaceRef(filePath, '/opt/nodejs', '../layer/nodejs')
  })
}

if (require.main === module) main()
