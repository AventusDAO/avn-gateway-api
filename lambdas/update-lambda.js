#!/usr/bin/env node

const {
  LambdaClient,
  GetFunctionCommand,
  ListLayersCommand,
  PublishLayerVersionCommand,
  UpdateFunctionCodeCommand,
  UpdateFunctionConfigurationCommand
} = require('@aws-sdk/client-lambda')
const aws = new LambdaClient({ region: 'eu-west-1' })
const fs = require('fs')
const join = require('path').join
const { spawn } = require('child-process-async')
const os = require('os')
const zipdir = require('zip-dir')

// TODO:
// Update lambda test scripts

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
  await publishSourceCode(lambda, layers)
}

async function getLambdaLayer(lambda, layerName, layerPath) {
  const functionDetails = await aws.send(new GetFunctionCommand({ FunctionName: lambda }))
  if (!functionDetails.Configuration?.Layers)
  {
    layer = await aws.send(new ListLayersCommand({ LayerName: layerName }))
    if (layer.Layers.length > 0) {
      // If there are changes in layer code or modules, run update-layer.js first
      return [layer.Layers[0].LatestMatchingVersion.LayerVersionArn]
    } else {
      const { LayerVersionArn } = await createLambdaLayer(layerName, layerPath)
      return [LayerVersionArn]
    }
  }
}
 
async function createLambdaLayer(layerName, layerPath) {
  await installNpmModules(layerName, layerPath)
  await aws.send(new PublishLayerVersionCommand({
    LayerName: layerName,
    Content: { ZipFile: await zipdir(layerPath) }
  }))
}

async function publishSourceCode(lambda, layers) {
  console.log('Publishing', lambda, 'to AWS...')
  const params = { ZipFile: await zipdir(lambda), FunctionName: lambda }
  const config = { FunctionName: lambda, Description: `${lambda} - Update script deployment`, Layers: layers }

  try {
    await aws.send(new UpdateFunctionConfigurationCommand(config))
    await aws.send(new UpdateFunctionCodeCommand(params))
    console.log('Published ', lambda)
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

async function installNpmModules(lambda, lambdaPath) {
   const npmCmd = os.platform().startsWith('win') ? 'npm.cmd' : 'npm'
   const child = spawn(npmCmd, ['i'], { env: process.env, cwd: lambdaPath, stdio: 'ignore' })
   await child.on('exit', () => {
     console.log('Node modules for', lambda, 'updated')
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