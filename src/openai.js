import { OpenAI } from 'openai'
import ora from 'ora'
import chalk from 'chalk'
import { z } from 'zod'
import { getOsType } from './utils/utils.js'

const zSchema = z.object({
  command: z.string().nullable(),
})

export function initOpenAI(apiKey) {
  return new OpenAI({ apiKey })
}

export async function prompt(userPrompt, openai) {
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
