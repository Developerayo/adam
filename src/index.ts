#!/usr/bin/env node

import { config } from 'dotenv'
import chalk from 'chalk'
import ora from 'ora'
import enquirer from 'enquirer'
import { ascii } from './utils/ascii'
import { configAdam, openConfigFile, getConfig, writeConfig } from './utils/config'
import { initOpenAI, prompt as promptOpenAI } from './services/openai'
import { initGemini, promptGemini } from './services/gemini'
import { useVoice } from './services/voice'
import { execCommand } from './helpers/execCommand'
import { analyzeCwd, fetchDependencyCount } from './helpers/cwdStructure'
import type { Config, CommandResponse } from './types'

config()
// @ts-ignore - Node.js process property
process.noDeprecation = true

interface UserPrompts {
	userName?: string
	task?: string
	userConfirmation?: boolean
}

const showHelp = (): void => {
	console.log(ascii)
	console.log(`
Usage: adam [command] [options]

Commands:
  config        Configure API keys and defaults
  open-config   Open config file in your default editor
  show-config   Show current configuration in your shell
  openai        Force using OpenAI for next command
  gemini        Force using Gemini for next command
  -voice        Use voice input for next command

Options:
  --help, -h    Show this help message
  --version, -v Show current version

Examples:
  $ adam "create a new react component"
  $ adam openai commit all current changes
  $ adam gemini install pymongo
  $ adam -voice
  `)
	process.exit(0)
}

async function newUser(): Promise<void> {
	const config = await getConfig()
	if (!config.userName) {
		const { userName } = await enquirer.prompt<UserPrompts>({
			type: 'input',
			name: 'userName',
			message: 'Before we proceed, what should I call you?',
		})
		config.userName = userName
		await writeConfig(config)
		console.log(chalk.green('Name saved!'))
		process.exit(0)
	}
}

const configs = async (args: string[]): Promise<boolean> => {
	if (args[0] === 'config') {
		await configAdam()
		return true
	}

	if (args[0] === 'open-config') {
		await openConfigFile()
		return true
	}

	if (args[0] === 'show-config') {
		const config = await getConfig()
		console.log(JSON.stringify(config, null, 2))
		return true
	}

	return false
}

const runAdam = async (): Promise<void> => {
	const args = process.argv.slice(2)
	await newUser()

	if (await configs(args)) {
		return
	}

	if (args[0] === '--help' || args[0] === '-h') {
		showHelp()
	}

	if (args[0] === '--version' || args[0] === '-v') {
		console.log(ascii)
		console.log('\nAdam CLI v0.1.0')
		process.exit(0)
	}

	const cwd = process.cwd()

	const isCommitRelated =
		args.join(' ').toLowerCase().includes('commit') || args.join(' ').toLowerCase().includes('push')

	const spinner = ora({
		color: 'cyan',
		spinner: 'dots',
	}).start()

	spinner.text = 'Scanning through workspace directory'
	const cwdStructure = await analyzeCwd(cwd, isCommitRelated)
	spinner.succeed(chalk.dim('Scaned through workspace directory'))

	spinner.start('Studying git info')
	const jsonStruct = {
		...cwdStructure,
		gitInfo: isCommitRelated
			? cwdStructure.gitInfo
			: {
					isGitRepo: cwdStructure.gitInfo.isGitRepo,
					hasCommits: cwdStructure.gitInfo.hasCommits,
					branch: cwdStructure.gitInfo.branch,
					remoteUrl: cwdStructure.gitInfo.remoteUrl,
			  },
	}
	spinner.succeed(chalk.dim('Studied git info'))

	if (jsonStruct.gitInfo.isGitRepo) {
		spinner.start('Checking git status')
		if (jsonStruct.gitInfo.changes?.length && jsonStruct.gitInfo.changes.length > 0) {
			spinner.warn(chalk.dim('Working tree not clean'))
			spinner.warn(chalk.dim(`Found ${jsonStruct.gitInfo.changes.length} uncommitted changes`))
		} else {
			spinner.succeed(chalk.dim('Working tree clean'))
		}
	}

	const depCount = fetchDependencyCount(jsonStruct)
	if (depCount !== null) {
		spinner.start('Scanning dependencies')
		if (Object.keys(depCount.byType).length > 1) {
			const depString = Object.entries(depCount.byType)
				.map(([type, count]) => `${count} ${type}`)
				.join(', ')
			spinner.succeed(chalk.dim(`Found ${depCount.total} total dependencies (${depString})`))
		} else {
			spinner.succeed(chalk.dim(`Found ${depCount.total} dependencies`))
		}
	}

	// investigate response: "DEBUG=true adam [some-comand]"
	if (process.env.DEBUG) {
		console.log(chalk.cyan('\nresponse:'))
		console.log(JSON.stringify(jsonStruct, null, 2))
	}

	// const openaiClient = initOpenAI()
	// if (!openaiClient) {
	//   console.log(
	//     chalk.red('API key not configured. Please run "adam config" to set up your API key.'),
	//   )
	//   return
	// }

	const config = await getConfig()
	let task = args.join(' ')
	let modelInUse: 'openai' | 'gemini' = config.defaultModel || 'openai'

	if (args[0] === 'openai' || args[0] === 'gemini') {
		modelInUse = args.shift() as 'openai' | 'gemini'
		task = args.join(' ')
	}

	console.log(chalk.cyan('\n⚡️ Model:'), chalk.bold(modelInUse.toUpperCase()))

	// const cwdStructure = analyzeCwd(cwd)

	if (args[0] === '-voice' || config.defaultPromptMethod === 'voice') {
		task = await useVoice()
		if (task === 'VOICE_EXIT') {
			process.exit(0)
		}
	}

	if (!task) {
		const greeting = config.userName
			? `Hi ${config.userName}, I'm Adam, What would you like me to do?`
			: "Hi, I'm Adam, What would you like me to do?"
		const response = await enquirer.prompt<UserPrompts>({
			type: 'input',
			name: 'task',
			message: greeting,
		})
		task = response.task || ''
	}

	let commandObj: CommandResponse
	if (modelInUse === 'gemini') {
		if (!config.geminiApiKey) {
			console.log(
				chalk.red('Google Gemini API key not configured. Please run "adam config" to set it up.'),
			)
			return
		}
		const gemini = initGemini(config.geminiApiKey)
		if (!gemini) {
			return
		}
		commandObj = await promptGemini(task, gemini, cwd)
	} else {
		if (!config.openaiApiKey) {
			console.log(
				chalk.red('OpenAI API key not configured. Please run "adam config" to set it up.'),
			)
			return
		}
		const openai = initOpenAI(config.openaiApiKey)
		if (!openai) {
			return
		}
		commandObj = await promptOpenAI(task, openai, cwd)
	}

	if (!commandObj || !commandObj.command) {
		console.log(chalk.red(commandObj?.message || 'No valid command created. Try again?'))
		return
	}

	const modelName = modelInUse === 'gemini' ? 'Gemini' : 'OpenAI'
	const modelColor = modelInUse === 'gemini' ? chalk.white.bgBlue : chalk.white.bgRed

	console.log(modelColor.bold(`[${modelName}]`) + chalk.white(` ${commandObj.command}`))

	const { userConfirmation } = await enquirer.prompt<UserPrompts>({
		type: 'confirm',
		name: 'userConfirmation',
		message: chalk.yellow('Ready to run this command?'),
		initial: true,
	})

	if (userConfirmation) {
		try {
			await execCommand(commandObj.command)
		} catch (error) {
			console.error(chalk.red(`Problem don dey o: ${(error as Error).message || error}`))
			console.log(
				chalk.yellow(
					'This could be due to the command not being found or not installed. You can reach out to @developerayo or @code_rabbi',
				),
			)
		}
	} else {
		console.log(chalk.yellow('Command execution ended'))
	}
}

runAdam().catch((unexpectedError: unknown) => {
	console.error(
		chalk.red('error:'),
		unexpectedError instanceof Error ? unexpectedError.message : String(unexpectedError),
	)
	process.exit(1)
})

process.on('SIGINT', () => {
	console.log(chalk.red('\nDie by fire'))
	process.exit(0)
})
