import { spawn } from 'child_process'
import os from 'os'
import chalk from 'chalk'
import enquirer from 'enquirer'
import { checkForFileOrFolder } from './utils/utils.js'

export async function execCommand(command) {
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
