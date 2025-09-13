export interface GitChange {
	status: string
	file: string
}

export interface GitInfo {
	isGitRepo: boolean
	hasCommits: boolean
	branch?: string
	remoteUrl?: string
	changes?: GitChange[]
	fullDiff?: string
	message?: string
}

export interface ProjectDetails {
	name?: string
	version?: string
	dependencies?: string[]
	gems?: string[]
	require?: string[]
	dotnet?: string[]
	scalaVersion?: string
	swiftToolsVersion?: string
	packageName?: string
	elixirVersion?: string
	appName?: string
	projectName?: string
	groupId?: string
	artifactId?: string
	moduleName?: string
	framework?: string
	buildSystem?: string
	platform?: string
	board?: string
	type?: string
	modelType?: string
}

export interface CwdStructure {
	types: string[]
	primaryType: string
	files: string[]
	gitInfo: GitInfo
	details: Record<string, ProjectDetails>
}

export interface DependencyCount {
	total: number
	byType: Record<string, number>
	types: string[]
}

export interface CommandResponse {
	command: string | null
	message?: string
	model?: string
}

export interface Config {
	userName?: string
	openaiApiKey?: string
	geminiApiKey?: string
	defaultModel?: 'openai' | 'gemini'
	assemblyaiApiKey?: string
	defaultPromptMethod?: 'text' | 'voice'
}

export type ProjectType =
	| 'nodejs'
	| 'python'
	| 'rust'
	| 'java'
	| 'go'
	| 'ruby'
	| 'php'
	| 'dotnet'
	| 'scala'
	| 'kotlin'
	| 'swift'
	| 'typescript'
	| 'dart'
	| 'r'
	| 'elixir'
	| 'clojure'
	| 'haskell'
	| 'solidity'
	| 'cpp'
	| 'embedded'
	| 'tensorflow'
	| 'pytorch'
