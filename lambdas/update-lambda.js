#!/usr/bin/env node

/*
  Description: 
    This script publishes any changes made within the lambda function folder to the corresponding AWS lambda function.
    It first cleans up node modules in a lambda function, removes any dependencies already defined in the layer folder.
    Then it installs all lambda function dependencies, creates a zip file containing all files within the lambda folder, 
    and publishes it to the AWS lambda function with a lambda layer if it is required by index.js.
    TODO -> if the lambda layer is required by any lambda function files
    If the changes are made within the layer folder, please run update-layer.js instead
    In order to use the testlocal function at the end of each lambda function's index.js file, please run update-local.js first
    TODO -> Update update.js and rename it to update-local.js, so it only merges layer dependencies and files into the lambda function,
    and installs all the dependencies. Update all require statement URIs from /opt/nodejs to ../layer/nodejs/
*/

const {
  LambdaClient,
  GetFunctionCommand,
  ListLayersCommand,
  UpdateFunctionCodeCommand,
  UpdateFunctionConfigurationCommand
} = require('@aws-sdk/client-lambda')
const aws = new LambdaClient({ region: 'eu-west-1' })
const fs = require('fs')
const join = require('path').join
const zipdir = require('zip-dir')
const { installNpmModules, createLambdaLayer } = require('./update-layer.js')

async function main() {
  const lambda = process.argv[2]
  if (!lambda) {
    console.log('lambda name is required')
    process.exit(1)
  }

  const paths = {
    lambda: join(__dirname, lambda),
    lambdaIdx: join(__dirname, lambda, 'index.js'),
    lambdaPkg: join(__dirname, lambda, 'package.json'),
    layer: join(__dirname, 'layer'),
    layerPkg: join(__dirname, 'layer/nodejs/package.json')
  }

  removeDependenciesAlreadyInLayer(paths)
  await installNpmModules(lambda, paths.lambda)
  const usesLambdaLayer = await updateDependenciesReferences(paths.lambdaIdx)
  if (usesLambdaLayer) {
    layers = await getLambdaLayer(lambda, 'common-layer', paths.layer)
  }
  await publishDescriptionAndLayer(lambda, layers)
  await publishSourceCode(lambda)
}

async function getLambdaLayer(lambda, layerName, layerPath) {
  const functionDetails = await aws.send(new GetFunctionCommand({ FunctionName: lambda }))
  if (!functionDetails.Configuration?.Layers)
  {
    layer = await aws.send(new ListLayersCommand({ LayerName: layerName }))
    if (layer.Layers.length > 0) {
      return [layer.Layers[0].LatestMatchingVersion.LayerVersionArn]
    } else {
      await installNpmModules(layerName, layerPath)
      const { LayerVersionArn } = await createLambdaLayer(layerName, layerPath)
      return [LayerVersionArn]
    }
  }
}

async function publishDescriptionAndLayer(lambda, layers) {
  try {
    console.log('Publishing Description and Layer for lambda function ', lambda, 'to AWS...')
    await aws.send(new UpdateFunctionConfigurationCommand({
      FunctionName: lambda,
      Description: `${lambda} - Update script deployment`,
      Layers: layers
    }))
    console.log('Description and Layer are Published', lambda)
  } catch (err) {
    console.log(lambda, '- Error:', err)
  }
}

async function publishSourceCode(lambda) {
  try {
    console.log('Publishing', lambda, 'to AWS...')
    await aws.send(new UpdateFunctionCodeCommand({
      ZipFile: await zipdir(lambda),
      FunctionName: lambda
    }))
    console.log('Source Code is Published ', lambda)
  } catch (err) {
    console.log(lambda, '- Error:', err)
  }
}

async function updateDependenciesReferences(lambdaIdxPath) {
  return await new Promise((resolve, reject) => {
    fs.readFile(lambdaIdxPath, 'utf8', function (err, fileBody) {
      if (err) {
        console.log(err)
        reject(err)
      }
      var updatedFileBody = fileBody.replace(/..\/layer\//gs, '/opt/nodejs/');
  
      fs.writeFile(lambdaIdxPath, updatedFileBody, 'utf8', function (err) {
        if (err) {
          console.log(err)
          reject(err)
        }
        resolve(updatedFileBody.includes('\/opt\/nodejs\/'))
      })
    })
  })
}

function removeDependenciesAlreadyInLayer(paths) {
  const lambdaPkg = require(paths.lambdaPkg)
  const layerPkg = require(paths.layerPkg)
  
  Object.entries(layerPkg.dependencies).forEach(
    ([module, _version] = dependency) => {
      if (lambdaPkg.dependencies[module])
        delete lambdaPkg.dependencies[module]
    }
  )
  fs.writeFileSync(paths.lambdaPkg, JSON.stringify(lambdaPkg, null, 2))
}

if (require.main === module) main()