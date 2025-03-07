'use strict';

const Q = require('q');
const { spawnSync, spawn } = require('child_process');
const path = require('path');
const yaml = require('js-yaml')
const fs = require('fs-extra')
const del = require('del')
const chalk = require('chalk')

module.exports = {
  buildContainer: buildContainer,
  install: install,
  copyRequirementsToFunction: copyRequirementsToFunction
}

async function version() {
  var deferred = Q.defer();

  const child = spawn('docker', ['run', 'rocketsam', 'cat', '/v.txt'],
    { encoding: 'utf-8' })
  
  child.stdout.on('data', function(code) {
    deferred.resolve(code)
  })

  return deferred.promise
}

async function buildContainer() {
  const scriptPath = path.dirname(require.main.filename)

  var deferred = Q.defer();

  const dockerVersion = await version()
  if (dockerVersion != 4) {
    const child = spawn('docker',
      ['build', '-t', 'rocketsam', `${scriptPath}/src/actions/build`],
      { encoding: 'utf-8' })
    
    child.stdout.on('data', function(code) {
      process.stdout.write(code);
    })

    child.stderr.on('data', function(error) {
      process.stderr.write(chalk.red(error));
    })

    child.on('close', function(code) {
      deferred.resolve()
    })
  }
  else {
    deferred.resolve()
  }
  
  return deferred.promise
}

async function install(appDir, buildDir, functionName) {
  const templateFile = `${appDir}/functions/${functionName}/template.yaml`  
  var doc = yaml.safeLoad(fs.readFileSync(templateFile, 'utf8'));

  switch(doc.Runtime) {
    case "python3.7":
    case "python3.6":
      return await installPythonRequirements(appDir, buildDir, functionName, doc.Runtime)
    case "nodejs8.10":
      return await installNodeRequirements(appDir, buildDir, functionName)
  }
}

async function installPythonRequirements(appDir, buildDir, functionName, runtime) {
  const isExist = fs.existsSync(`${appDir}/functions/${functionName}/requirements.txt`)
  if (!isExist) {
    return true
  }


  await fs.mkdirSync(`${buildDir}/.requirements/${functionName}`, { recursive: true })
  await del([`${buildDir}/.requirements/${functionName}/*`]);

  const dockerCommand = ["run",
    "-v", `${appDir}:/app`,
    "-v", `${buildDir}:/build`,
    "rocketsam"
  ]

  const pipCommand = [runtime, `-m`, `pip`, `install`, `-r`,
    `/app/functions/${functionName}/requirements.txt`,
    `-t`, `/build/.requirements/${functionName}`]

  const fullCommand = dockerCommand.concat(pipCommand)

  return await runInstallCommand(fullCommand)
}

async function installNodeRequirements(appDir, buildDir, functionName) {
  await fs.mkdirSync(`${buildDir}/.requirements/${functionName}`, { recursive: true })
  await del([`${buildDir}/.requirements/${functionName}/*`]);

  const dockerCommand = ["run",
    "-v", `${appDir}:/app`,
    "-v", `${buildDir}:/build`,
    "rocketsam"
  ]
  
  const pipCommand = [`npm`, `install`, `/app/functions/${functionName}`,
    `--prefix`, `/build/.requirements/${functionName}`]

  const fullCommand = dockerCommand.concat(pipCommand)

  return await runInstallCommand(fullCommand)
}

function runInstallCommand(commandArray) {
  var deferred = Q.defer();

  const child = spawn('docker', commandArray,
  { encoding: 'utf-8' })


  child.stdout.on('data', function(code) {
    process.stdout.write(code);
  })

  child.stderr.on('data', function(error) {
    process.stderr.write(error);
  })

  child.on('close', function(code) {
    deferred.resolve(code == 0)
  })

  return deferred.promise
}

async function copyRequirementsToFunction(buildDir, functionName) {
  const functionRequirementsFolder = `${buildDir}/.requirements/${functionName}`
  const functionBuildFolder = `${buildDir}/functions/${functionName}`

  try {
    const requirements = fs.readdirSync(functionRequirementsFolder)
      .filter((f) => !f.startsWith("."))
    for (var i = 0; i < requirements.length; i++) {
      const dst = `${functionBuildFolder}/${requirements[i]}`
      const src =  `${functionRequirementsFolder}/${requirements[i]}`

      // It will symlink the folder files
      // and the zip will convert them to the appropriate files
      fs.symlinkSync(src, dst)
    }

  }
  catch (e) {
  }
}
