/*
  Description:
    This script merges layer dependencies into lambda function dependencies list, 
    and updates all layer file URIs from /opt/nodejs/ to ../layer/nodejs/ in lambda function files
*/

const fs = require('fs')
const join = require('path').join
const { LAMBDAS, getAllFilesPaths } = require('./update-lambda.js')
const { installNpmModules } = require('./update-layer.js')

async function updateNodeModulesAndFiles(lambda) {
  const layerPkg = join(__dirname, 'layer/nodejs/package.json')
  const lambdaPkg = join(__dirname, lambda, 'package.json')
  mergeLayerDependencies(layerPkg, lambdaPkg)

  const lambdaPath = join(__dirname, lambda)
  await installNpmModules(lambda, lambdaPath)

  const lambdaFilesPaths = getAllFilesPaths(lambdaPath)
  lambdaFilesPaths.forEach(filePath => {
    replaceRef(filePath, '/opt/nodejs', '../layer/nodejs')
  })
}

function mergeLayerDependencies(layerPkgPath, lambdaPkgPath) {
  const layerPkg = require(layerPkgPath)
  const lambdaPkg = require(lambdaPkgPath)

  Object.entries(layerPkg.dependencies).forEach(
    ([module, version] = dependency) => (lambdaPkg.dependencies[module] = version)
  )
  fs.writeFileSync(lambdaPkgPath, JSON.stringify(lambdaPkg, null, 2))
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
