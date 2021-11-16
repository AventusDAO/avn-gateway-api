/*
  Description:
    This script merges layer dependencies into lambda function dependencies list, 
    and updates all layer file URIs from /opt/nodejs/ to ../layer/nodejs/ in lambda function files
*/

const join = require('path').join
const { LAMBDAS } = require('./update-lambda.js')
const { replaceRef, mergePkgDependencies, installPkgDependencies, getAllFilesPaths } = require('./utils.js')

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
