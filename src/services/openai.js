import { OpenAI } from 'openai'
import ora from 'ora'
import chalk from 'chalk'
import { z } from 'zod'
import { zodResponseFormat } from 'openai/helpers/zod'
import { analyzeCwd } from '../helpers/cwdStructure.js'
import { getOsType } from '../utils/utils.js'

const CommandStepSchema = z.object({
  command: z.string().nullable(),
  message: z.string().optional(),
})

export function initOpenAI(apiKey) {
  return new OpenAI({ apiKey })
}

export async function prompt(userPrompt, openai, cwd) {
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
    const completion = await openai.beta.chat.completions.parse({
      model: 'gpt-4o-2024-08-06',
      messages: [
        {
          role: 'system',
          content: `You are an expert CLI Assistant. Generate the exact executable command based on the user request.

Operating System: ${osType}

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
`,
        },
        { role: 'user', content: userPrompt },
      ],
      response_format: zodResponseFormat(CommandStepSchema, 'command_response'),
    })

    loader.succeed('Command created')

    const result = completion.choices[0].message.parsed

    if (result.command && result.command.trim() === '') {
      result.command = null
    }

    return result
  } catch (error) {
    loader.fail('Failed to create command')
    console.error(chalk.red('error:'), error instanceof Error ? error.message : String(error))
    return { command: null, message: 'Failed to create command: ' + error.message }
  }
}
