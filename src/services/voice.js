import { exec } from 'child_process'
import { AssemblyAI } from 'assemblyai'
import recorder from 'node-record-lpcm16'
import enquirer from 'enquirer'
import chalk from 'chalk'
import { promisify } from 'util'

const execAsync = promisify(exec)

export async function checkSox() {
  try {
    await execAsync('sox --version')
    return true
  } catch (error) {
    console.log(chalk.red("sox is not installed. It's required for Adam voice commands."))
    console.log(chalk.yellow('Installation instructions:'))
    console.log(chalk.yellow('- On macOS: brew install sox'))
    console.log(chalk.yellow('- On Ubuntu or Debian: sudo apt-get install sox'))
    console.log(chalk.yellow('- On Windows: Download from https://sourceforge.net/projects/sox/'))
    return false
  }
}

export async function alternativeChoice() {
  const { choice } = await enquirer.prompt({
    type: 'select',
    name: 'choice',
    message: 'What would you like to do?',
    choices: ['Continue with text input', 'Exit and install sox'],
  })

  return choice === 'Continue with text input'
}

export async function useVoice() {
  const soxAvail = await checkSox()
  if (!soxAvail) {
    const continueWithText = await alternativeChoice()
    if (!continueWithText) {
      return null
    }
  }

  const client = new AssemblyAI({
    apiKey: process.env.ASSEMBLYAI_API_KEY,
  })

  const realTime = client.realtime.transcriber({
    sampleRate: 16000,
    endpointDetection: true,
    endpointDetectionMs: 1000, // after 1s of pause
  })

  return new Promise((resolve, reject) => {
    let recording

    realTime.on('open', ({ sessionId }) => {
      // console.log(chalk.cyan(`${sessionId}`))
      console.log(chalk.cyan('Speak Lord... (Press Ctrl+C to stop)'))

      recording = recorder.record({
        sampleRateHertz: 16000,
        threshold: 0,
        // verbose: false,
        recordProgram: 'rec',
        silence: '2.0',
      })

      recording.stream().on('data', chunk => {
        realTime.sendAudio(chunk)
      })
    })

    realTime.on('transcript', async transcript => {
      if (transcript.message_type === 'FinalTranscript') {
        console.log('\n' + chalk.green('Recognized: ') + transcript.text)
        if (recording) {
          recording.stop()
        }
        realTime.close()

        const result = await prompt(transcript.text, openai, cwd)

        resolve(result)
      }
    })

    realTime.on('error', error => {
      console.error(chalk.red('Transcript error:', error))
      if (recording) {
        recording.stop()
      }
      reject(error)
    })

    // console.log(chalk.cyan('Connect to rt transcript service'))
    realTime.connect().catch(err => {
      console.error(chalk.red('Failed to connect to AssemblyAI:', err))
      reject(err)
    })

    process.on('SIGINT', () => {
      console.log(chalk.yellow('\nStopping recording...'))
      if (recording) {
        recording.stop()
      }
      realTime.close()
      resolve('')
    })
  })
}