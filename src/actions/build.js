'use strict';

const Q = require('q');
const fs = require('fs-extra')
const zipFolder = require('folder-zip-sync')
const { readdirSync, statSync } = require('fs')
const { join } = require('path')
const yaml = require('js-yaml')
const Selector = require('node-option')
const del = require('del')
var dirsum = require('dirsum');
var chalk = require('chalk');

const appDir = `${process.cwd()}/app`
const buildDir = `${process.cwd()}/.build`

module.exports = {
	build: async function(option) {
		const dirsFunction = p => readdirSync(p).filter(f => statSync(join(p, f)).isDirectory() && f != "common")

		const dirs = dirsFunction(appDir)

		var result = []
		if (option == undefined) {
			const selector = new Selector({
			  markWrapperColor: 'white',
			  checkedMarkColor: 'white',
			  textColor: 'yellow',
			  multiselect: true,
			});

			console.log("Choose which function to build")

			selector.add("build all (with cache)", 1)

			dirs.forEach(function(dir) {
				selector.add(dir)
			});
			result = await selector.render()
		}
		else {
			if (option == "all") {
				result = [1]
			}
			else {
				result = [option]
			}
		}
		if (result.includes(1)) {
			await parseOptionResults(dirs)
		}
		else {
			await parseOptionResults(result)
		}
	}
}

async function parseOptionResults(results) {
	for (var i = 0; i < results.length; i++) {
		const dep = await getDependencies(`${results[i]}/function.py`)
		dep.shift()

		console.log(chalk.yellow(`${results[i]}:`) + chalk.bold(` ${dep.length}`) + ` common dependencies`)

		await populateFunctionCommonFolder(results[i], dep)

		await functionBuildFolder(results[i], [])
	};
}

async function getDependencies(filename, dependencies = []) {
	if (filename == "") {
		return dependencies
	}
	try {
		var contents = fs.readFileSync(`${appDir}/${filename}`, 'utf8');

		// After location the dependency file was found
		dependencies.push(filename)


		const firstLineEnd = contents.indexOf('\n')
		if (firstLineEnd > -1) {
			const diLine = contents.slice(0, firstLineEnd)
			if (diLine[0] != "#") {
				return dependencies
			}

			const diStartLocation = contents.indexOf("DI:")
			if (diStartLocation == -1) {
				return dependencies
			}

			// DI found
			const files = diLine.slice(diStartLocation + 3).split(" ")
			for (var i = 0; i < files.length; i++) {
				if (!dependencies.includes(files[i])) {
					dependencies = await getDependencies(files[i], dependencies)
				}

			}
		}
	} catch (err) {
		console.error(`missing dependency ${filename}`)
	}

	return dependencies
}

async function populateFunctionCommonFolder(functionName, dependencies, location=appDir, commonSymlinks=true) {
	// Delete the previous function common folder
	await del([`${location}/${functionName}/common`]);

	for (var i = 0; i < dependencies.length; i++) {
		// Create the common folder structure
		const folderStructure = dependencies[i].substring(0 ,dependencies[i].lastIndexOf("/"));
		await fs.mkdirSync(`${location}/${functionName}/${folderStructure}`, { recursive: true })

		// Link the dependency
		const srcTarget = `${appDir}/${dependencies[i]}`
		const dstTarget = `${location}/${functionName}/${dependencies[i]}`
		if (commonSymlinks) {
			await fs.symlinkSync(srcTarget, dstTarget)
		}
		else {
			await fs.copyFileSync(srcTarget, dstTarget);
		}
	}
}

async function functionBuildFolder(functionName, dependencies) {
	const functionBuildFolder = `${buildDir}/${functionName}`
	const functionAppFolder = `${appDir}/${functionName}`

	// Creates if not exists the build folder
	//alongside the sub directories .hash and the function folder
	await fs.mkdirSync(`${buildDir}/.hash`, { recursive: true })
	await fs.mkdirSync(functionBuildFolder, { recursive: true })
	// Delete the previous created build folder
	await del([functionBuildFolder]);
	// Copy the function app folder to the build folder
	await fs.copy(`${appDir}/${functionName}`, functionBuildFolder)

	// Delete the template folder in the function build folder
	await del([`${functionBuildFolder}/template.yaml`])

	const hashUtil = require("./build/hash_util.js")

	const newHash = await hashUtil.calculateHashForDirectoy(functionBuildFolder)
	const oldHash = await hashUtil.getHashesFromBuildFolder(functionName)

	if (newHash.total != oldHash.total) {
		console.log(chalk.green("(m) code"))
		if (newHash.requirements != oldHash.requirements) {
			console.log(chalk.green("(m) requirements"))
		}

		await hashUtil.putHashesForFunction(functionName, newHash)

		zipFolder(functionBuildFolder, `${functionBuildFolder}.zip`, [])
	}
	else {
		console.log(chalk.blueBright("(#) no changes detected"));
	}
}
