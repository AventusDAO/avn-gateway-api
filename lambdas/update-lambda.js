/*
  Description:
    This script publishes any changes made within the lambda function folder to the corresponding AWS lambda function.

    It contains the following steps:
      1. Clean up node modules in a lambda function, remove any dependencies already defined in the layer folder.
      2. Install all lambda function dependencies defined in the package.json file within lambda function folder
      3. Compress all files within the lambda function folder into a zip file and publish it to the AWS lambda function with a lambda layer if it is required by the lambda function files.

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
const { join, extname } = require('path')
const zipdir = require('zip-dir')
const {
  LAYER_NAME,
  installNpmModules,
  createLambdaLayer,
  publishLambdaLayer
} = require('./update-layer.js')

const LAMBDAS = [
  'poll-handler',
  'query-handler',
  'send-handler',
  'authorisation-handler',
  'tx-status-update-handler'
]

async function main() {
  try {
    const lambda = process.argv[2]
    const lambdas = lambda === 'all' ? LAMBDAS : [lambda]
    await Promise.all(lambdas.map(async (lambda) => {
      await updateNodeModulesAndPublish(lambda)
    }))
  } catch (err) {
    console.log('***** Updating Failed:', err.message)
  }
}

async function updateNodeModulesAndPublish(lambda) {
  if (!LAMBDAS.includes(lambda)) {
    console.log('***** Error: no such lambda', lambda)
    return
  }

  const paths = {
    lambda: join(__dirname, lambda),
    lambdaIdx: join(__dirname, lambda, 'index.js'),
    lambdaPkg: join(__dirname, lambda, 'package.json'),
    layer: join(__dirname, 'layer'),
    layerPkg: join(__dirname, 'layer/nodejs/package.json')
  }

  if (!fs.existsSync(paths.lambda)) {
    console.error(`***** ${lambda} source code is not found`)
    return
  }

  await updateNodeModules(lambda, paths)
  const usesLambdaLayer = await updateRequirePathsInLambdaFiles(paths.lambda)
  const layers = usesLambdaLayer ? await getLambdaLayer(lambda, LAYER_NAME, paths.layer) : null
  await publish(lambda, layers)
}

async function updateNodeModules(lambda, paths) {
  const lambdaHasDependencies = paths.lambdaPkg?.dependencies?.length > 0
  if (lambdaHasDependencies) {
    removeLayerDependencies(paths)
    await installNpmModules(lambda, paths.lambda)
  }
}

function removeLayerDependencies(paths) {
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

async function updateRequirePathsInLambdaFiles(lambdaPath) {
  const lambdaFilesPaths = getAllFilesPaths(lambdaPath)
  await Promise.all(lambdaFilesPaths.map(async (lambdaFilePath) => {
    await updateRequirePathsInFile(lambdaFilePath)
  }))
}

function getAllFilesPaths(dirPath, foundFiles) {
  files = fs.readdirSync(dirPath)
  foundFiles = foundFiles || []
  files.forEach(function(file) {
    if (file !== 'node_modules') {
      if (fs.statSync(dirPath + "/" + file).isDirectory()) {
        foundFiles = getAllFilesPaths(dirPath + "/" + file, foundFiles)
      } else if (extname(file).toLowerCase() === '.js') {
        foundFiles.push(join(dirPath, "/", file))
      }
    }
  })
  return foundFiles
}

async function updateRequirePathsInFile(filePath) {
  return await new Promise((resolve, reject) => {
    fs.readFile(filePath, 'utf8', function (err, fileBody) {
      if (err) {
        console.log(err)
        reject(err)
      }
      var updatedFileBody = fileBody.replace(/..\/layer\//gs, '/opt/nodejs/');
  
      fs.writeFile(filePath, updatedFileBody, 'utf8', function (err) {
        if (err) {
          console.log(err)
          reject(err)
        }
        resolve(updatedFileBody.includes('\/opt\/nodejs\/'))
      })
    })
  })
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

async function publish(lambda, layers) {
  console.log('Publishing', lambda, 'to AWS...')
  const description = `${lambda} - Update script deployment`
  await publishLambdaLayer(lambda, description, layers)
  await publishSourceCode(lambda)
  console.log('Published', lambda)
}

async function publishSourceCode(lambda) {
  try {
    await aws.send(new UpdateFunctionCodeCommand({
      ZipFile: await zipdir(lambda),
      FunctionName: lambda
    }))
  } catch (err) {
    console.log(lambda, '- Error:', err)
  }
}

if (require.main === module) main()

module.exports = {
  LAMBDAS,
  getAllFilesPaths
}