import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import enquirer from 'enquirer'
import chalk from 'chalk'
import { exec as execCallback } from 'child_process'
import { promisify } from 'util'

const exec = promisify(execCallback)
const CONFIG_FILE = path.join(os.homedir(), '.adam-cli.json')

export async function getConfig() {
  try {
    const data = await fs.readFile(CONFIG_FILE, 'utf8')
    return JSON.parse(data)
  } catch (error) {
    console.error(`Error reading config: ${error.message}`)
    return {}
  }
}

async function writeConfig(config) {
  await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2))
}

export async function configAdam() {
  let config = await getConfig()
  const { configChoice } = await enquirer.prompt({
    type: 'select',
    name: 'configChoice',
    message: 'What would you like to configure?',
    choices: [
      'Configure OpenAI',
      'Configure Voice Command via AssemblyAI [BETA FEATURE]',
      'Select default way of interacting with Adam',
    ],
  })

  switch (configChoice) {
    case 'Configure OpenAI':
      const { apiKey } = await enquirer.prompt({
        type: 'password',
        name: 'apiKey',
        message: 'Please enter your OpenAI API KEY:',
      })
      config.openaiApiKey = apiKey
      console.log(chalk.green('OpenAI API Key saved.'))
      break
    case 'Configure Voice Command via AssemblyAI [BETA FEATURE]':
      const { assemblyaiApiKey } = await enquirer.prompt({
        type: 'password',
        name: 'assemblyaiApiKey',
        message: 'Please enter your AssemblyAI API KEY:',
      })
      config.assemblyaiApiKey = assemblyaiApiKey
      console.log(chalk.green('AssemblyAI API Key saved.'))
      break
    case 'Select default way of interacting with Adam':
      const { defaultPromptMethod } = await enquirer.prompt({
        type: 'select',
        name: 'defaultPromptMethod',
        message: 'Choose default way of interacting with Adam [BETA FEATURE]:',
        choices: ['Text', 'Voice'],
      })
      config.defaultPromptMethod = defaultPromptMethod.toLowerCase()
      console.log(chalk.green('Default method saved.'))
      break
  }

  await writeConfig(config)
}

export async function openConfigFile() {
  if (!(await fs.stat(CONFIG_FILE).catch(() => false))) {
    console.log(chalk.yellow('Config does not exist. Run "adam config" to create it.'))
    return
  }

  const openEditor =
    process.platform === 'win32' ? 'start' : process.platform === 'darwin' ? 'open' : 'xdg-open'

  try {
    await exec(`${openEditor} ${CONFIG_FILE}`)
    console.log(chalk.green('Config file opened'))
  } catch (error) {
    console.log(chalk.red(`Failed to open config file: ${error.message}`))
  }
}