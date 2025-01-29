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
  const isCommitRelated = userPrompt.toLowerCase().includes('commit')
  const cwdStructure = await analyzeCwd(cwd, isCommitRelated)

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

      if (isCommitRelated && gitInfo.fullDiff) {
        gitStatus += `\n\nFull diff:\n${gitInfo.fullDiff}`
      }
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

Project Analysis: ${JSON.stringify(cwdStructure, null, 2)}

Git Status: ${gitStatus}

CORE BEHAVIORS:
1. ALWAYS analyze cwdStructure FIRST - Use project structure to determine ALL command decisions!

Guidelines:
1. Produce only the command to be executed.
2. Ensure compatibility with the specified OS and project structure.
3. Avoid including any explanations or additional text in your response.
4. Ensure the commands are structured in a way that they can be directly executed in the terminal.
5. Return "Please Cross Check Your Request" if the request is invalid or impossible.
6. Again, leverage the project analysis/cwdStructure for context-aware commands.

For git commits, create a message following these rules:

VERY CRITICAL RULES:
1. Again, ALWAYS analyze cwdStructure first:
   - Check "primaryType" for main project type
   - Check "details" for existing dependencies
   - Use ONLY the standard package manager for detected project type
   - NEVER use system package managers (brew, apt) or virtual environment paths when project type is detected

2. Command Generation:
   - Check if package already exists in dependencies, if found: Return null with message "X already listed as dependency in Y"
   - If not found: Generate installation command using project's standard package manager
   - For removals: If package exists → generate removal command
   - For upgrades: Always generate upgrade command

Type: feat, fix, ref, docs, style, test, chore

Commit Guidelines:
- Be extremely specific about the main code changes
- Use the format: <type>: <specific description>
- Aim for 50 characters, but prioritize specificity over brevity
- Use imperative mood (e.g., "implement" not "implemented")
- No period at the end
- Enclose the entire message in double quotes

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

    return { ...result, model: 'OpenAI' }
  } catch (error) {
    loader.fail('Failed to create command')
    console.error(chalk.red('error:'), error instanceof Error ? error.message : String(error))
    return { command: null, message: 'Failed to create command: ' + error.message }
  }
}
