#!/usr/bin/env node

import { config } from 'dotenv'
import chalk from 'chalk'
import ora from 'ora'
import enquirer from 'enquirer'
import { configAdam, openConfigFile, getConfig } from './src/utils/config.js'
import { initOpenAI, prompt as promptOpenAI } from './src/services/openai.js'
import { initGemini, promptGemini } from './src/services/gemini.js'
import { useVoice } from './src/services/voice.js'
import { execCommand } from './src/helpers/execCommand.js'
import { analyzeCwd, fetchDependencyCount } from './src/helpers/cwdStructure.js'

config()
process.noDeprecation = true

const runAdam = async () => {
  const args = process.argv.slice(2)
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
    if (jsonStruct.gitInfo.changes?.length > 0) {
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

  if (args[0] === 'config') {
    await configAdam()
    return
  }

  if (args[0] === 'open-config') {
    openConfigFile()
    return
  }

  if (args[0] === 'show-config') {
    const config = await getConfig()
    console.log(JSON.stringify(config, null, 2))
    return
  }

  const openai = initOpenAI()
  if (!openai) {
    console.log(
      chalk.red('API key not configured. Please run "adam config" to set up your API key.'),
    )
    return
  }

  const config = await getConfig()
  let task = args.join(' ')
  let modelInUse = config.defaultModel

  if (args[0] === 'openai' || args[0] === 'gemini') {
    modelInUse = args.shift()
    task = args.join(' ')
  }

  console.log(chalk.cyan('\n⚡️ Model:'), chalk.bold(modelInUse.toUpperCase()))

  // const cwdStructure = analyzeCwd(cwd)

  if (args[0] === '-voice' || config.defaultPromptMethod === 'voice') {
    task = await useVoice()
  }

  if (!task) {
    const response = await enquirer.prompt({
      type: 'input',
      name: 'task',
      message: "Hi, I'm Adam, What would you like me to do?",
    })
    task = response.task
  }

  let commandObj
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
    console.log(chalk.red(commandObj.message || 'No valid command created. Try again?'))
    return
  }

  const modelName = modelInUse === 'gemini' ? 'Gemini' : 'OpenAI'
  const modelColor = modelInUse === 'gemini' ? chalk.white.bgBlue : chalk.white.bgRed

  console.log(modelColor.bold(`[${modelName}]`) + chalk.white(` ${commandObj.command}`))

  const { userConfirmation } = await enquirer.prompt({
    type: 'confirm',
    name: 'userConfirmation',
    message: chalk.yellow('▶️  Ready to run this command?'),
    initial: false,
    format: value => chalk.bold(value ? 'Yes' : 'No'),
  })

  if (userConfirmation) {
    try {
      await execCommand(commandObj.command, cwdStructure)
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

process.on('SIGINT', () => {
  console.log(chalk.red('\nDie by fire'))
  process.exit(0)
})
