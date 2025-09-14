import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import enquirer from 'enquirer'
import chalk from 'chalk'
import { exec as execCallback } from 'child_process'
import { promisify } from 'util'
import type { Config } from '../types'

const exec = promisify(execCallback)
const CONFIG_FILE = path.join(os.homedir(), '.adam-cli.json')

interface ConfigPrompts {
	configChoice?: string
	userName?: string
	openaiApiKey?: string
	geminiApiKey?: string
	defaultModel?: 'openai' | 'gemini'
	assemblyaiApiKey?: string
	defaultPromptMethod?: string
}

export async function getConfig(): Promise<Config> {
	try {
		const data = await fs.readFile(CONFIG_FILE, 'utf8')
		return JSON.parse(data)
	} catch (error) {
		if ((error as Error).message.includes('JSON')) {
			console.log(chalk.red('Config file corrupted. Adam is starting from scratch...'))
			await fs.unlink(CONFIG_FILE).catch(() => {})
		}
		return {}
	}
}

export async function writeConfig(config: Config): Promise<void> {
	await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2))
}

export async function configAdam(): Promise<void> {
	let config = await getConfig()
	const { configChoice } = await enquirer.prompt<ConfigPrompts>({
		type: 'select',
		name: 'configChoice',
		message: 'What would you like to configure?',
		choices: [
			'Set your name',
			'Configure OpenAI',
			'Configure Google Gemini',
			'Select default AI model',
			'Configure Voice Command via AssemblyAI [BETA FEATURE]',
			'Select default way of interacting with Adam',
		],
	})
	switch (configChoice) {
		case 'Set your name': {
			const { userName } = await enquirer.prompt<ConfigPrompts>({
				type: 'input',
				name: 'userName',
				message: 'What should I call you?',
				initial: config.userName || '',
			})
			config.userName = userName
			console.log(chalk.green('Name saved!'))
			break
		}
		case 'Configure OpenAI': {
			const { openaiApiKey } = await enquirer.prompt<ConfigPrompts>({
				type: 'password',
				name: 'openaiApiKey',
				message: 'Please enter your OpenAI API KEY:',
			})
			config.openaiApiKey = openaiApiKey
			console.log(chalk.green('OpenAI API Key saved.'))
			break
		}
		case 'Configure Google Gemini': {
			const { geminiApiKey } = await enquirer.prompt<ConfigPrompts>({
				type: 'password',
				name: 'geminiApiKey',
				message: 'Please enter your Google Gemini API KEY:',
			})
			config.geminiApiKey = geminiApiKey
			console.log(chalk.green('Google Gemini API Key saved.'))
			break
		}
		case 'Select default AI model': {
			const { defaultModel } = await enquirer.prompt<ConfigPrompts>({
				type: 'select',
				name: 'defaultModel',
				message: 'Choose default AI model:',
				choices: ['openai', 'gemini'],
			})
			config.defaultModel = defaultModel
			console.log(chalk.green(`Default AI model configured to ${defaultModel}`))
			break
		}
		case 'Configure Voice Command via AssemblyAI [BETA FEATURE]': {
			const { assemblyaiApiKey } = await enquirer.prompt<ConfigPrompts>({
				type: 'password',
				name: 'assemblyaiApiKey',
				message: 'Please enter your AssemblyAI API KEY:',
			})
			config.assemblyaiApiKey = assemblyaiApiKey
			console.log(chalk.green('AssemblyAI API Key saved.'))
			break
		}
		case 'Select default way of interacting with Adam': {
			const { defaultPromptMethod } = await enquirer.prompt<ConfigPrompts>({
				type: 'select',
				name: 'defaultPromptMethod',
				message: 'Choose default way of interacting with Adam [BETA FEATURE]:',
				choices: ['Text', 'Voice'],
			})
			config.defaultPromptMethod = defaultPromptMethod?.toLowerCase() as 'text' | 'voice'
			console.log(chalk.green('Default method saved.'))
			break
		}
	}

	await writeConfig(config)
}

export async function openConfigFile(): Promise<void> {
	try {
		await fs.stat(CONFIG_FILE)
	} catch {
		console.log(chalk.yellow('Config does not exist. Run "adam config" to create it.'))
		return
	}

	const openEditor =
		process.platform === 'win32' ? 'start' : process.platform === 'darwin' ? 'code' : 'xdg-open'

	try {
		await exec(`${openEditor} ${CONFIG_FILE}`)
		console.log(chalk.green('Config file opened'))
	} catch (error) {
		console.log(chalk.red(`Failed to open config file: ${(error as Error).message}`))
	}
}
