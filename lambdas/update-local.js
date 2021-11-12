/*
  Description:
    This script installs all dependencies for both layer and lambda function, and updates all URIs 
    for files shared in the layer folder from /opt/nodejs/ to ../layer/nodejs/
*/

const fs = require('fs')
const join = require('path').join
const { LAMBDAS, getAllFilesPaths } = require('./update-lambda.js')
const { LAYER_NAME, installNpmModules } = require('./update-layer.js')

async function updateNodeModulesAndFiles(lambda) {
  const layerPath = join(__dirname, 'layer')
  await installNpmModules(LAYER_NAME, layerPath)

  const lambdaPath = join(__dirname, lambda)
  await installNpmModules(lambda, lambdaPath)

  const lambdaFilesPaths = getAllFilesPaths(lambdaPath)
  lambdaFilesPaths.forEach(filePath => {
    replaceRef(filePath, '/opt/nodejs', '../layer/nodejs')
  })
}

function replaceRef(file, a, b) {
  fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(a, b), 'utf8')
}

async function main() {
  const lambda = process.argv[2]
  if (lambda === 'all') {
    LAMBDAS.forEach(lambda => updateNodeModulesAndFiles(lambda))
  } else if (LAMBDAS.includes(lambda)) {
    updateNodeModulesAndFiles(lambda)
  } else {
    console.log('Error: no such lambda')
  }
}

if (require.main === module) main()
