import chalk from 'chalk'
import enquirer from 'enquirer'
import https from 'https'
import os from 'os'
import readline from 'readline'

import { chmod, mkdir, readFile } from 'fs/promises'
import { createWriteStream, existsSync, unlink } from 'fs'
import { exec, spawn } from 'child_process'
import { join, resolve, dirname } from 'path'
import { promisify } from 'util'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

function wait(duration: number = 10): Promise<void> {
	return new Promise(function (resolve) {
		setTimeout(() => resolve(), duration * 1000)
	})
}

const execAsync = promisify(exec)
const platform = os.platform()

const whisperPath = join(__dirname, 'bin', 'whisper')
const modelPath = join(__dirname, 'bin', 'ggml-base.bin')
const audioFile = 'input.wav'

const recordCommand = 'sox'
const recordArgs = [
	'-d', // Use default recording device
	'-c',
	'1', // Mono channel
	'-b',
	'16', // 16-bit samples
	'-r',
	'16000', // 16kHz sample rate
	audioFile, // Output file
	'silence',
	'1',
	'0.1',
	'1%',
	'1',
	'3.0',
	'1%', // Silence detection parameters
]

async function checkSoxInstallation(): Promise<boolean> {
	try {
		await execAsync('sox --version')
		return true
	} catch (error) {
		console.log(chalk.red("Sox is not installed. It's required for Adam voice commands."))

		if (platform === 'win32') {
			console.log(chalk.yellow('Download Sox from https://sourceforge.net/projects/sox/'))
		} else if (platform === 'darwin') {
			console.log(chalk.yellow('Installing it using: brew install sox'))
		} else if (platform === 'linux') {
			console.log(chalk.yellow('Installing it using: sudo apt-get install sox'))
		} else {
			console.log(chalk.yellow('It can be installed manually:'))
			console.log(chalk.yellow('- On macOS: brew install sox'))
			console.log(chalk.yellow('- On Ubuntu or Debian: sudo apt-get install sox'))
			console.log(chalk.yellow('- On Windows: Download from https://sourceforge.net/projects/sox/'))
			process.exit(1)
		}
		console.log(chalk.yellow('Or via the Adam CLI'))
		return false
	}
}
async function checkWhisperInstallation(): Promise<boolean> {
	if (existsSync(whisperPath) && existsSync(modelPath)) {
		return true
	}
	console.log(chalk.yellow('It seems you have not installed Adam voice'))
	return false
}
async function handleNoSoxChoice(): Promise<'continueWithTextInput' | 'setupWithCLI' | 'exit'> {
	let action: 'continueWithTextInput' | 'setupWithCLI' | 'exit' = 'continueWithTextInput'

	try {
		const { choice } = await enquirer.prompt<{ choice: string }>({
			type: 'select',
			name: 'choice',
			message: 'What would you like to do?',
			choices: [
				'Continue with text input',
				'Set up Adam voice via the CLI',
				'Exit and install sox manually',
			],
		})

		if (choice === 'Set up Adam voice via the CLI') {
			action = 'setupWithCLI'
		} else if (choice === 'Exit and install sox manually') {
			action = 'exit'
		}
	} catch {
		// Do nothing here
	}
	return action
}
async function handleNoWhisperChoice(): Promise<'continueWithTextInput' | 'installWhisper'> {
	let action: 'continueWithTextInput' | 'installWhisper' = 'continueWithTextInput'

	try {
		const { choice } = await enquirer.prompt<{ choice: string }>({
			type: 'select',
			name: 'choice',
			message: 'What would you like to do?',
			choices: ['Continue with text input', 'Install Adam voice'],
		})

		if (choice === 'Install Adam voice') {
			action = 'installWhisper'
		}
	} catch {
		// Do nothing here
	}

	return action
}

async function downloadFile(url: string, dest: string): Promise<void> {
	return new Promise((resolve, reject) => {
		const file = createWriteStream(dest)

		const request = https.get(url, response => {
			// Github releases usually have a redirect, so download from the redirect link instead.
			if (response.statusCode === 302 || response.statusCode === 301) {
				const location = response.headers.location
				if (location) {
					downloadFile(location, dest).then(resolve).catch(reject)
				} else {
					reject(new Error('Redirect location not found'))
				}
				return
			}

			if (response.statusCode !== 200) {
				return reject(new Error(`Failed to get '${url}' (${response.statusCode})`))
			}

			response.pipe(file)

			file.on('finish', () => {
				file.close((err?: Error | null) => {
					if (err) reject(err)
					else resolve()
				})
			})
		})

		request.on('error', err => {
			// Delete the file if there's an error
			unlink(dest, () => {
				console.error(`Error downloading file: ${err.message}`)
				reject(err)
			})
		})

		request.end()
	})
}
async function installHomebrew(): Promise<void> {
	try {
		await execAsync('brew --version')
	} catch (error) {
		console.log(chalk.yellow('Homebrew is not installed'))
		console.log('Installing Homebrew...')
		await execAsync(
			'/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"',
		)
	}
}
async function installSox(): Promise<void> {
	try {
		if (platform === 'win32') {
			console.log(chalk.yellow('Pls download Sox from https://sourceforge.net/projects/sox/'))
		} else if (platform === 'darwin') {
			console.log('Installing Sox...')
			await installHomebrew()
			await execAsync('brew install sox')
		} else if (platform === 'linux') {
			console.log('Installing sox...')
			await execAsync('sudo apt-get update')
			await execAsync('sudo apt-get install -y sox libsox-fmt-all')
		} else {
			console.error(chalk.red('We do not recognize this OS. Please install Sox manually.'))
			process.exit(1)
		}
	} catch (err) {
		console.error(chalk.red(`Failed to install Sox: ${(err as Error).message}`))
		process.exit(1)
	}
}
async function installWhisper(): Promise<void> {
	let whisperBinaryUrl = ''
	if (platform === 'linux') {
		// TODO: Get Whisper.cpp build for linux
		whisperBinaryUrl =
			'https://github.com/emekaorji/eciovmada/releases/download/v0.0.1/whisper-linux'
	} else if (platform === 'darwin') {
		whisperBinaryUrl =
			'https://github.com/emekaorji/eciovmada/releases/download/v0.0.1/whisper-macos'
	} else if (platform === 'win32') {
		// TODO: Get Whisper.cpp build for windows
		whisperBinaryUrl =
			'https://github.com/emekaorji/eciovmada/releases/download/v0.0.1/whisper-windows.exe'
	} else {
		console.error('Unsupported platform')
		process.exit(1)
	}
	const modelUrl = 'https://github.com/emekaorji/eciovmada/releases/download/v0.0.1/ggml-base.bin'

	const binDir = join(__dirname, 'bin')

	if (!existsSync(binDir)) await mkdir(binDir)

	try {
		console.log('Downloading whisper.cpp binary...')
		await downloadFile(
			whisperBinaryUrl,
			join(binDir, platform === 'win32' ? 'whisper.exe' : 'whisper'),
		)
		console.log('Whisper.cpp binary downloaded.')
	} catch (error) {
		console.error('Failed to download whisper.cpp binary.', error)
		process.exit(1)
	}

	try {
		console.log('Downloading model file...')
		await downloadFile(modelUrl, join(binDir, 'ggml-base.bin'))
		console.log('Model file downloaded.')
	} catch (error) {
		console.error('Failed to download model file.')
		process.exit(1)
	}

	try {
		if (platform !== 'win32') {
			console.log('Making the binary executable...')
			await chmod(whisperPath, '755')
		}
	} catch (error) {
		console.log(chalk.red('A problem occurred while making the binary executable.'))
		process.exit(1)
	}

	console.log('Setup complete.')
}
async function confirmInstallation(): Promise<void> {
	try {
		await execAsync('sox --version')
		if (!(existsSync(whisperPath) && existsSync(modelPath))) {
			throw new Error('')
		}
	} catch (error) {
		console.log(chalk.red('A problem occurred while installing Adam voice, pls try again.'))
	}
}
async function setupAdamVoice(): Promise<void> {
	try {
		await installSox()
		await installWhisper()
		await confirmInstallation()
	} catch (error) {
		console.log(chalk.red('There was a problem with the installation of Adam voice.\n'), error)
	}
}

const spawnAsync = (command: string, args: string[]): Promise<void> => {
	return new Promise((resolve, reject) => {
		const proc = spawn(command, args)

		proc.on('close', code => {
			if (code !== 0) {
				reject(new Error(`${command} process exited with code ${code}`))
			} else {
				resolve()
			}
		})

		proc.on('error', err => {
			reject(err)
		})
	})
}
const waitForEnterKeyPress = (): Promise<void> => {
	return new Promise(resolve => {
		const rl = readline.createInterface({
			input: process.stdin,
			output: process.stdout,
		})

		rl.on('line', () => {
			rl.close()
			resolve()
		})
	})
}
const recordAudio = async (): Promise<void> => {
	console.log('Adam listening... Press ENTER to stop or simply stop speaking.')

	const recording = spawn(recordCommand, recordArgs)

	// Wait for either ENTER press or the recorder to finish
	await Promise.race([
		waitForEnterKeyPress(),
		new Promise<void>(resolve => recording.on('close', () => resolve())),
	])

	recording.kill('SIGINT') // Ensure we stop the recording process
}
const processAudio = async (): Promise<string> => {
	await spawnAsync(whisperPath, ['-m', modelPath, '-f', audioFile, '--translate', '--output-txt'])

	// Reading the translated text from the output file
	const outputFile = audioFile + '.txt'
	const translatedText = await readFile(outputFile, 'utf8')

	console.log(translatedText.trim())
	return translatedText.trim()
}

export async function useVoice(): Promise<string> {
	try {
		const soxAvail = await checkSoxInstallation()
		if (!soxAvail) {
			const noSoxChoice = await handleNoSoxChoice()
			await wait(40)

			if (noSoxChoice === 'continueWithTextInput') return ''

			if (noSoxChoice === 'setupWithCLI') await setupAdamVoice()

			if (noSoxChoice === 'exit') return 'VOICE_EXIT'
		}

		const whisperAvail = await checkWhisperInstallation()
		if (!whisperAvail) {
			const noWhisperChoice = await handleNoWhisperChoice()
			// await wait(40)

			if (noWhisperChoice === 'continueWithTextInput') return ''

			if (noWhisperChoice === 'installWhisper') await installWhisper()
		}

		await recordAudio()
		const task = await processAudio()
		return task
	} catch (error) {
		return ''
	}
}
