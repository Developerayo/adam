#!/usr/bin/env node

import { OpenAI } from 'openai'
import { config } from 'dotenv'
import { exec, spawn } from 'child_process'
import { promisify } from 'util'
import ora from 'ora'
import enquirer from 'enquirer'
import chalk from 'chalk'
import os from 'os'
import { z } from 'zod'
// import { LocalStorage } from 'node-localstorage';
import path from 'path'
import fs from 'fs'

const CONFIG_FILE = path.join(os.homedir(), '.adam-cli.json')

const execAsync = promisify(exec)
config()

async function configAdam() {
  const { model } = await enquirer.prompt({
    type: 'select',
    name: 'model',
    message: 'What model would you like to configure?',
    choices: ['OpenAI'],
  })

  if (model === 'OpenAI') {
    const { apiKey } = await enquirer.prompt({
      type: 'password',
      name: 'apiKey',
      message: 'Please enter your OpenAI API KEY:',
    })

    const config = { openaiApiKey: apiKey }
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2))
    console.log(chalk.green('Key configured successfully.'))
  }
}

function openConfigFile() {
  if (!fs.existsSync(CONFIG_FILE)) {
    console.log(chalk.yellow('Config does not exist. Run "adam config" to create it.'))
    return
  }

  const openEditor =
    process.platform === 'win32' ? 'start' : process.platform === 'darwin' ? 'open' : 'xdg-open'

  exec(`${openEditor} ${CONFIG_FILE}`, error => {
    if (error) {
      console.log(chalk.red(`Failed to open config file: ${error.message}`))
    } else {
      console.log(chalk.green('Config file opened'))
    }
  })
}

function getConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'))
  } catch (error) {
    return {}
  }
}

function initOpenAI() {
  const config = getConfig()
  if (config.openaiApiKey) {
    return new OpenAI({ apiKey: config.openaiApiKey })
  }
  return null
}

function getOsType() {
  return os.type()
}

function checkForFileOrFolder(name, isFile = false) {
  const fullPath = path.join(process.cwd(), name)
  try {
    const stats = fs.statSync(fullPath)
    return isFile ? stats.isFile() : stats.isDirectory()
  } catch (error) {
    return false
  }
}

const zSchema = z.object({
  command: z.string().nullable(),
})

const prompt = async (userPrompt, openai) => {
  const loader = ora('Creating command...').start()
  const osType = getOsType()

  try {
    const completer = await openai.chat.completions.create({
      model: 'gpt-4o-2024-08-06',
      messages: [
        {
          role: 'system',
          content: `You're a CLI Assistant that generates shell commands based on the user's input. The user's OS is: ${osType}
            
                      Guideline:
                      1. If the input is a valid task, return a JSON object like this: 

                      { "command": "The exact command to run" }

                      2. Focus solely on producing the command script based on the user's prompt.

                      3. No explanations in command fields, just the raw commands.
                      4. Do not generate personal opinions or advice.
                      5. Make sure all commands work for the user's OS.`,
        },
        { role: 'user', content: userPrompt },
      ],
    })

    loader.succeed('Command created')

    const content = completer.choices[0].message.content.trim()
    let result

    try {
      result = zSchema.parse(JSON.parse(content))
    } catch (jsonError) {
      result = zSchema.parse({ command: content })
    }

    if (result.command && result.command.trim() === '') {
      result.command = null
    }

    return result
  } catch (error) {
    loader.fail('Failed to create command')
    console.error(chalk.red('error:'), error instanceof Error ? error.message : String(error))
    return { command: null }
  }
}

const execCommand = async command => {
  const currentDir = process.cwd()
  console.log(chalk.cyan(`\n> About to run this command: ${command}`))

  const commandLower = command.toLowerCase()

  if (commandLower.includes('mkdir') || commandLower.includes('touch')) {
    const words = command.split(' ')
    const name = words[words.length - 1]
    if (checkForFileOrFolder(name)) {
      console.log(chalk.red(`A file or folder named "${name}" already exists.`))
      return
    }
  }

  if (commandLower.includes('cd ')) {
    const words = command.split(' ')
    const dir = words[words.length - 1]
    if (!checkForFileOrFolder(dir)) {
      console.log(chalk.red(`The folder "${dir}" does not exist.`))
      return
    }
  }

  if (
    commandLower.includes('rm') ||
    commandLower.includes('delete') ||
    commandLower.includes('remove')
  ) {
    const words = command.split(' ')
    const itemName = words[words.length - 1]

    const { confirmName } = await enquirer.prompt({
      type: 'input',
      name: 'confirmName',
      message: `Safety first! To confirm, type "${itemName}" in here:`,
    })

    if (confirmName !== itemName) {
      console.log(chalk.red('Names do not match. Exited for your safety.'))
      return
    }

    const { confirmFirstTime } = await enquirer.prompt({
      type: 'confirm',
      name: 'confirmFirstTime',
      message: 'You sure about this? Unexpected bad things will happen if not! ',
      initial: false,
    })

    if (!confirmFirstTime) {
      console.log(chalk.yellow('Operation cancelled.'))
      return
    }

    const { confirmSecondTime } = await enquirer.prompt({
      type: 'confirm',
      name: 'confirmSecondTime',
      message: 'Last chance to stop. This cannot be undone.',
      initial: false,
    })

    if (!confirmSecondTime) {
      console.log(chalk.yellow('Operation cancelled.'))
      return
    }
  }

  return new Promise((resolve, reject) => {
    let childProcess

    if (os.platform() === 'win32') {
      childProcess = spawn('cmd.exe', ['/c', command], {
        cwd: currentDir,
        stdio: 'inherit',
      })
    } else {
      const shellCheck = `
                if [ -f ~/.zshrc ]; then
                    source ~/.zshrc
                elif [ -f ~/.bash_profile ]; then
                    source ~/.bash_profile
                elif [ -f ~/.bashrc ]; then
                    source ~/.bashrc
                fi
                ${command}
            `
      const cleanedUp = shellCheck.replace(/'/g, "'\\''")
      childProcess = spawn('/bin/sh', ['-c', `bash -c 'zsh -c "${cleanedUp}"'`], {
        cwd: currentDir,
        stdio: 'inherit',
      })
    }

    childProcess.on('close', exitCode => {
      if (exitCode === 0) {
        console.log(chalk.green('\n✔ Command executed successfully!'))
        resolve()
      } else {
        reject(new Error(`Failed: ${exitCode}`))
      }
    })

    childProcess.on('error', errorDetails => {
      reject(errorDetails)
    })
  })
}

const runAdam = async () => {
  const args = process.argv.slice(2)

  if (args[0] === 'config' && args.length === 1) {
    await configAdam()
    return
  }

  if (args[0] === 'open-config') {
    openConfigFile()
    return
  }

  const openai = initOpenAI()
  if (!openai) {
    console.log(
      chalk.red('API key not configured. Please run "adam config" to set up your API key.'),
    )
    return
  }

  let task = args.join(' ')

  if (!task) {
    const response = await enquirer.prompt({
      type: 'input',
      name: 'task',
      message: "Hi, I'm Adam, What would you like me to do?",
    })
    task = response.task
  }

  let commandObj = await prompt(task, openai)
  if (!commandObj || !commandObj.command) {
    console.log(chalk.red('No valid command created. Try again?'))
    return
  }

  console.log(chalk.cyan('Created command:'))
  console.log(commandObj.command)

  const { userConfirmation } = await enquirer.prompt({
    type: 'confirm',
    name: 'userConfirmation',
    message: 'Ready to run this command?',
    initial: true,
  })

  if (userConfirmation) {
    try {
      await execCommand(commandObj.command)
    } catch (error) {
      console.error(chalk.red(`Problem don dey o: ${error.message || error}`)),
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

runAdam().catch(unexpectedError => {
  console.error(
    chalk.red('error:'),
    unexpectedError instanceof Error ? unexpectedError.message : String(unexpectedError),
  )
  process.exit(1)
})
