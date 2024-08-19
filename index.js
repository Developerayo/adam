#!/usr/bin/env node

import { config } from 'dotenv'
import chalk from 'chalk'
import enquirer from 'enquirer'
import { configAdam, openConfigFile, getConfig } from './src/config.js'
import { initOpenAI, prompt } from './src/openai.js'
import { useVoice, checkSox, alternativeChoice } from './src/voice.js'
import { execCommand } from './src/execCommand.js'

config()

const runAdam = async () => {
  const args = process.argv.slice(2)

  if (args[0] === 'config') {
    await configAdam()
    return
  }

  if (args[0] === 'open-config') {
    openConfigFile()
    return
  }

  if (args[0] === 'show-config') {
    const config = getConfig()
    // console.log(chalk.cyan('show'))
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

  const config = getConfig()
  let task = args.join(' ')

  if (args[0] === '-voice' || config.defaultPromptMethod === 'voice') {
    if (!config.assemblyaiApiKey) {
      console.log(
        chalk.red('AssemblyAI API key not configured. Please run "adam config" to set it up.'),
      )
      return
    }
    const soxAvail = await checkSox()
    if (!soxAvail) {
      const continueWithText = await alternativeChoice()
      if (!continueWithText) {
        return
      }
    } else {
      process.env.ASSEMBLYAI_API_KEY = config.assemblyaiApiKey
      try {
        task = await useVoice()
        if (task === null) {
          console.log(chalk.yellow('Voice input stopped.'))
          return
        }
        if (!task) {
          console.log(chalk.red('No incoming speech. Please try again.'))
          return
        }
      } catch (error) {
        console.error(chalk.red(`Recognition failed: ${error.message}`))
        return
      }
    }
  }

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
     format: value => value ? 'Yes' : 'No'
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
