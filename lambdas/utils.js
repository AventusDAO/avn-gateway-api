const fs = require('fs')
const { join, extname } = require('path')
const os = require('os')
const { spawn } = require('child-process-async')

function mergePkgDependencies(sourcePkgPath, targetPkgPath) {
  const sourcePkg = require(sourcePkgPath)
  const targetPkg = require(targetPkgPath)

  Object.entries(sourcePkg.dependencies).forEach(
    ([module, version] = dependency) => (targetPkg.dependencies[module] = version)
  )
  fs.writeFileSync(targetPkgPath, JSON.stringify(targetPkg, null, 2))
}

async function installPkgDependencies(project, projectPath) {
  const npmCmd = os.platform().startsWith('win') ? 'npm.cmd' : 'npm'
  const child = spawn(npmCmd, ['i'], { env: process.env, cwd: projectPath, stdio: 'ignore' })
  await child.on('exit', () => {
    console.log('Node modules for', project, 'updated')
  })
}

function getAllFilesPaths(dirPath, foundFiles) {
  files = fs.readdirSync(dirPath)
  foundFiles = foundFiles || []
  files.forEach(function(file) {
    if (file !== 'node_modules') {
      if (extname(file).toLowerCase() === '.js') {
        foundFiles.push(join(dirPath, "/", file))
      } else if (fs.statSync(dirPath + "/" + file).isDirectory()) {
        foundFiles = getAllFilesPaths(dirPath + "/" + file, foundFiles)
      }
    }
  })
  return foundFiles
}

function replaceRef(file, a, b) {
  fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(a, b), 'utf8')
}

module.exports = {
  replaceRef,
  mergePkgDependencies,
  installPkgDependencies,
  getAllFilesPaths
}