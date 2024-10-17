import fetch, { Headers } from 'node-fetch'
import { GoogleGenerativeAI } from '@google/generative-ai'
import ora from 'ora'
import chalk from 'chalk'
import { z } from 'zod'
import { analyzeCwd } from '../helpers/cwdStructure.js'
import { getOsType } from '../utils/utils.js'

globalThis.fetch = fetch
globalThis.Headers = Headers

const CommandStepSchema = z.object({
  command: z.string().nullable(),
  message: z.string().optional(),
})

export function initGemini(apiKey) {
  if (!apiKey) {
    console.log(chalk.red('Gemini API key is missing. Please configure it using "adam config".'))
    return null
  }
  return new GoogleGenerativeAI(apiKey)
}

export async function promptGemini(userPrompt, gemini, cwd) {
  const loader = ora('Creating command...').start()
  const osType = getOsType()
  const cwdStructure = await analyzeCwd(cwd)

  const gitInfo = cwdStructure.gitInfo
  let gitStatus = 'Not a git repo or git is not installed'
  if (gitInfo && gitInfo.isGitRepo) {
    gitStatus = `Git repository ${gitInfo.hasCommits ? 'with' : 'without'} commits.`
    if (gitInfo.branch) gitStatus += ` Branch: ${gitInfo.branch}.`
    gitStatus += ` Remote URL: ${gitInfo.remoteUrl}.`
    if (gitInfo.changes && gitInfo.changes.length > 0) {
      gitStatus +=
        `\nChanges (${gitInfo.changes.length}):\n` +
        gitInfo.changes.map(change => `${change.status} ${change.file}`).join('\n')
    } else {
      gitStatus += '\nNo changes'
    }
  }

  try {
    const model = gemini.getGenerativeModel({ model: 'gemini-pro' })

    const prompt = `You are an expert CLI Assistant. Generate the exact executable command based on the user request.

Operating System: ${osType}
Project Analysis: ${JSON.stringify(cwdStructure, null, 2)}

Git Status:
${gitStatus}

Guidelines:
1. Produce only the command to be executed.
2. Ensure compatibility with the specified OS and project structure.
3. Avoid including any explanations or additional text in your response.
4. Ensure the commands are structured in a way that they can be directly executed in the terminal.
5. Return null if the request is invalid or impossible.
6. Leverage the project analysis for context-aware commands.

For git commits, create a message following these rules:
Guidelines:
- Analyze the changes in the Project Analysis thoroughly
- Attempt to fulfill the user's request as long as you understand it and it's not nonsensical.
- Be extremely specific about the main code changes
- Use the format: <type>: <specific description>
- Aim for 50 characters, but prioritize specificity over brevity
- Use imperative mood (e.g., "implement" not "implemented")
- No period at the end
- Enclose the entire message in double quotes

Types: feat, fix, ref, docs, style, test, chore

Examples:
git add . && git commit -m "feat: implement JWT-based user authentication in auth.js"
git add . && git commit -m "fix: resolve race condition in worker.js processQueue function"
git add . && git commit -m "ref: simplify error handling in api/errors.js"
git add . && git commit -m "docs: update API usage instructions for new endpoints"
git add . && git commit -m "style: apply consistent indentation in src directory"
git add . && git commit -m "test: add unit tests for user registration process"
git add . && git commit -m "chore: update babel and webpack to latest versions"

Constraints:
- Do not generate personal opinions or advice.
- Focus on accuracy, efficiency, and direct executability
- Do not include any commentary or explanation in the responses.
- Focus solely on producing the command script based on the user's prompt.

User Request: ${userPrompt}

Respond with a JSON object in the following format:
{
  "command": "The generated command or null if invalid",
  "message": "Optional message explaining why the command is null"
}
`

    const result = await model.generateContent(prompt)
    const generatedText = result.response.text()

    let response
    try {
      response = JSON.parse(generatedText)
    } catch (error) {
      console.error(chalk.red('Error parsing Gemini response:'), error)
      return { command: null, message: 'Failed to parse Gemini response', model: 'Gemini' }
    }

    loader.succeed('Command created')

    if (response.command && response.command.trim() === '') {
      response.command = null
    }

    // Msg always has to be a string
    if (response.message === null || response.message === undefined) {
      response.message = ''
    }

    return { ...CommandStepSchema.parse(response), model: 'Gemini' }
  } catch (error) {
    loader.fail('Failed to create command')
    console.error(chalk.red('error:'), error instanceof Error ? error.message : String(error))
    return { command: null, message: 'Failed to create command: ' + error.message, model: 'Gemini' }
  }
}
