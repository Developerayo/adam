import fs from 'fs/promises'
import path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

const projectDirMap = {
  nodejs: ['package.json'],
  python: ['requirements.txt', 'setup.py', 'Pipfile', 'pyproject.toml'],
  rust: ['Cargo.toml'],
  java: ['pom.xml', 'build.gradle'],
  go: ['go.mod'],
  ruby: ['Gemfile'],
  php: ['composer.json'],
  dotnet: ['*.csproj', '*.fsproj', '*.vbproj'],
  scala: ['build.sbt'],
  kotlin: ['build.gradle.kts'],
  swift: ['Package.swift'],
  typescript: ['tsconfig.json'],
  dart: ['pubspec.yaml'],
  r: ['r'],
  elixir: ['mix.exs'],
  clojure: ['project.clj', 'deps.edn'],
  haskell: ['*.cabal', 'stack.yaml'],
  solidity: ['truffle-config.js', 'hardhat.config.js'],
  cpp: ['CMakeLists.txt', 'Makefile'],
  embedded: ['platformio.ini', 'Kconfig', 'sdkconfig'],
  tensorflow: ['saved_model.pb', '*.h5', 'checkpoint'],
  pytorch: ['*.pt', '*.pth', 'model.onnx'],
}

async function doesFileExist(cwd, file) {
  if (file.includes('*')) {
    const regex = new RegExp(file.replace('*', '.*'))
    const files = await fs.readdir(cwd)
    return files.some(f => regex.test(f))
  }
  return fs
    .stat(path.join(cwd, file))
    .then(() => true)
    .catch(() => false)
}

export async function getGitInfo(cwd, isFullInfoNeeded = false) {
  try {
    // Check for git [true/false]
    await execAsync('git rev-parse --is-inside-work-tree', { cwd })

    let branch = ''
    let remoteUrl = ''
    let status = ''
    let diff = ''

    // Check for commits
    const hasCommits = await execAsync('git rev-parse --verify HEAD', { cwd })
      .then(() => true)
      .catch(() => false)

    if (hasCommits) {
      try {
        const branchDetails = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd })
        branch = branchDetails.stdout.trim()

        if (isFullInfoNeeded) {
          const diffdetails = await execAsync('git diff HEAD', { cwd })
          diff = diffdetails.stdout
        }
      } catch (error) {
        console.error('Error getting git branch or diff:', error)
      }
    }

    try {
      status = await execAsync('git status --porcelain', { cwd })
    } catch (error) {
      console.error('Error getting git status:', error)
    }

    try {
      const getRemoteUrl = await execAsync('git config --get remote.origin.url', { cwd })
      remoteUrl = getRemoteUrl.stdout.trim()
    } catch (error) {
      remoteUrl = 'No remote URL has been configured.'
    }

    const changes =
      status && status.stdout ? status.stdout.split('\n').filter(line => line.trim() !== '') : []

    const detailedChanges = changes.map(change => {
      const [status, ...fileParts] = change.trim().split(' ')
      const file = fileParts.join(' ')
      return { status, file }
    })

    return isFullInfoNeeded
      ? {
          isGitRepo: true,
          hasCommits,
          branch,
          remoteUrl,
          changes: detailedChanges,
          fullDiff: diff,
        }
      : {
          isGitRepo: true,
          hasCommits,
          branch,
          remoteUrl,
        }
  } catch (error) {
    return {
      isGitRepo: false,
      hasCommits: false,
      message: 'Not a git repository',
    }
  }
}

async function scanProjectDir(cwd, type, files) {
  switch (type) {
    case 'nodejs':
    case 'typescript':
      const packageJson = JSON.parse(await fs.readFile(path.join(cwd, 'package.json'), 'utf8'))
      return {
        name: packageJson.name,
        version: packageJson.version,
        dependencies: Object.keys(packageJson.dependencies || {}),
      }
    case 'python':
      if (await doesFileExist(cwd, 'requirements.txt')) {
        const requirements = await fs.readFile(path.join(cwd, 'requirements.txt'), 'utf8')
        return {
          dependencies: requirements.split('\n').filter(line => line.trim() !== ''),
        }
      }
      break
    case 'rust': {
      const cargoToml = await fs.readFile(path.join(cwd, 'Cargo.toml'), 'utf8')
      const rsDepSelection = cargoToml.split('[dependencies]')[1]?.split('[')[0] || ''

      const dependencies = rsDepSelection
        .split('\n')
        .filter(line => line.trim() && line.includes('='))
        .map(line => line.split('=')[0].trim())
        .filter(Boolean)

      return {
        name: cargoToml.match(/name\s*=\s*"(.+)"/)?.[1],
        version: cargoToml.match(/version\s*=\s*"(.+)"/)?.[1],
        dependencies: dependencies,
      }
    }
    case 'java':
      if (await doesFileExist(cwd, 'pom.xml')) {
        const pom = await fs.readFile(path.join(cwd, 'pom.xml'), 'utf8')
        return {
          groupId: pom.match(/<groupId>(.*?)<\/groupId>/)?.[1],
          artifactId: pom.match(/<artifactId>(.*?)<\/artifactId>/)?.[1],
          version: pom.match(/<version>(.*?)<\/version>/)?.[1],
        }
      }
      break
    case 'go':
      const go = await fs.readFile(path.join(cwd, 'go.mod'), 'utf8')
      const goContent = go.toString()

      // Get all go dep
      const allDeps = goContent
        .split('\n')
        .filter(
          line =>
            line.trim().startsWith('github.com/') ||
            line.trim().startsWith('golang.org/') ||
            line.trim().startsWith('google.golang.org/') ||
            line.trim().startsWith('filippo.io/') ||
            line.trim().startsWith('go.') ||
            line.trim().startsWith('gonum.org/') ||
            line.trim().startsWith('gopkg.in/'),
        )
        .map(line => line.split(' ')[0].trim())
        .filter(Boolean)

      return {
        moduleName: goContent.match(/module\s+(.+)/)?.[1],
        dependencies: allDeps,
      }
    case 'ruby':
      const gemfile = await fs.readFile(path.join(cwd, 'Gemfile'), 'utf8')
      return {
        gems:
          gemfile.match(/gem\s+['"](\S+)['"]/g)?.map(gem => gem.match(/['"](\S+)['"]/)[1]) || [],
      }
    case 'php':
      const composerJson = JSON.parse(await fs.readFile(path.join(cwd, 'composer.json'), 'utf8'))
      return {
        name: composerJson.name,
        require: Object.keys(composerJson.require || {}),
      }
    case 'dotnet':
      const dotnet = (await fs.readdir(cwd)).filter(
        file => file.endsWith('.csproj') || file.endsWith('.fsproj') || file.endsWith('.vbproj'),
      )
      return {
        dotnet: dotnet,
      }
    case 'scala':
    case 'kotlin':
      const kotlinScala = await fs.readFile(
        path.join(cwd, type === 'scala' ? 'build.sbt' : 'build.gradle.kts'),
        'utf8',
      )
      return {
        scalaVersion: kotlinScala.match(/scalaVersion\s*:=\s*"(.+)"/)?.[1],
      }
    case 'swift':
      const swift = await fs.readFile(path.join(cwd, 'Package.swift'), 'utf8')
      return {
        swiftToolsVersion: swift.match(/swift-tools-version:(.+)/)?.[1]?.trim(),
      }
    case 'dart':
      const dart = await fs.readFile(path.join(cwd, 'pubspec.yaml'), 'utf8')
      return {
        name: dart.match(/name:\s*(.+)/)?.[1],
        dependencies:
          dart
            .match(/dependencies:([\s\S]*?)(\n\n|\Z)/)?.[1]
            .match(/^\s+\S+:/gm)
            ?.map(d => d.trim().replace(':', '')) || [],
      }
    case 'r':
      const r = await fs.readFile(path.join(cwd, 'r'), 'utf8')
      return {
        packageName: r.match(/Package:\s*(.+)/)?.[1],
        version: r.match(/Version:\s*(.+)/)?.[1],
      }
    case 'elixir':
      const elixe = await fs.readFile(path.join(cwd, 'mix.exs'), 'utf8')
      return {
        appName: elixe.match(/project:\s*:(\w+)/)?.[1],
        elixirVersion: elixe.match(/elixir:\s*"(.+)"/)?.[1],
      }
    case 'clojure':
      if (await doesFileExist(cwd, 'project.clj')) {
        const cloju = await fs.readFile(path.join(cwd, 'project.clj'), 'utf8')
        return {
          projectName: cloju.match(/defproject\s+(\S+)/)?.[1],
        }
      }
      break
    case 'haskell':
      const haskellFiles = (await fs.readdir(cwd)).filter(file => file.endsWith('.cabal'))
      if (haskellFiles.length > 0) {
        const cabalContent = await fs.readFile(path.join(cwd, haskellFiles[0]), 'utf8')
        return {
          name: cabalContent.match(/name:\s*(.+)/i)?.[1],
          version: cabalContent.match(/version:\s*(.+)/i)?.[1],
        }
      }
      break
    case 'solidity':
      if (await doesFileExist(cwd, 'truffle-config.js')) {
        return { framework: 'Truffle' }
      } else if (await doesFileExist(cwd, 'hardhat.config.js')) {
        return { framework: 'Hardhat' }
      }
      break
    case 'cpp':
      if (await doesFileExist(cwd, 'CMakeLists.txt')) {
        const cpp = await fs.readFile(path.join(cwd, 'CMakeLists.txt'), 'utf8')
        return {
          projectName: cpp.match(/project\((\w+)/)?.[1],
          buildSystem: 'CMake',
        }
      } else if (await doesFileExist(cwd, 'Makefile')) {
        return { buildSystem: 'Make' }
      }
      break
    case 'embedded':
      if (await doesFileExist(cwd, 'platformio.ini')) {
        const ini = await fs.readFile(path.join(cwd, 'platformio.ini'), 'utf8')
        return {
          framework: 'PlatformIO',
          platform: ini.match(/platform\s*=\s*(\w+)/)?.[1],
          board: ini.match(/board\s*=\s*(\w+)/)?.[1],
        }
      } else if (await doesFileExist(cwd, 'Kconfig')) {
        return { type: 'Linux-based Embedded System' }
      } else if (await doesFileExist(cwd, 'sdkconfig')) {
        return { type: 'ESP-IDF Project' }
      }
      break
    case 'tensorflow':
      if (await doesFileExist(cwd, 'saved_model.pb')) {
        return { modelType: 'SavedModel' }
      } else if ((await fs.readdir(cwd)).some(file => file.endsWith('.h5'))) {
        return { modelType: 'Keras H5' }
      } else if (await doesFileExist(cwd, 'checkpoint')) {
        return { modelType: 'Checkpoint' }
      }
      break
    case 'pytorch':
      if ((await fs.readdir(cwd)).some(file => file.endsWith('.pt') || file.endsWith('.pth'))) {
        return { modelType: 'Serialized' }
      } else if (await doesFileExist(cwd, 'model.onnx')) {
        return { modelType: 'ONNX' }
      }
      break
  }
  return {}
}

export function fetchDependencyCount(jsonStruct) {
  if (!jsonStruct.types || jsonStruct.types.length === 0) {
    return null
  }

  const dependencyCounts = {}
  let totalCount = 0

  for (const type of jsonStruct.types) {
    const details = jsonStruct.details[type]
    let count = 0

    switch (type) {
      case 'nodejs':
      case 'typescript':
        count = details?.dependencies?.length || 0
        break
      case 'python':
        count = details?.dependencies?.length || 0
        break
      case 'rust':
        count = Object.keys(details?.dependencies || {}).length
        break
      case 'java':
        count = details?.dependencies?.length || 0
        break
      case 'go':
        count = details?.dependencies?.length || 0
        break
      case 'ruby':
        count = details?.gems?.length || 0
        break
      case 'php':
        count = details?.require?.length || 0
        break
      case 'dotnet':
        count = details?.dotnet?.length || 0
        break
      case 'scala':
      case 'kotlin':
        count = details?.dependencies?.length || 0
        break
      case 'swift':
        count = details?.dependencies?.length || 0
        break
      case 'dart':
        count = details?.dependencies?.length || 0
        break
      case 'r':
        count = details?.dependencies?.length || 0
        break
      case 'elixir':
        count = details?.dependencies?.length || 0
        break
      case 'clojure':
        count = details?.dependencies?.length || 0
        break
      case 'haskell':
        count = details?.dependencies?.length || 0
        break
      case 'solidity':
        count = details?.dependencies?.length || 0
        break
      case 'cpp':
        count = details?.dependencies?.length || 0
        break
      case 'embedded':
        count = details?.dependencies?.length || 0
        break
      case 'tensorflow':
      case 'pytorch':
        count = details?.dependencies?.length || 0
        break
      default:
        count = 0
    }

    if (count > 0) {
      dependencyCounts[type] = count
      totalCount += count
    }
  }

  return {
    total: totalCount,
    byType: dependencyCounts,
    types: jsonStruct.types,
  }
}

export async function analyzeCwd(cwd, isCommitRelated = false) {
  const files = await fs.readdir(cwd)
  const gitInfo = await getGitInfo(cwd, isCommitRelated)

  const detectedTypes = []
  for (const [projectType, typeFiles] of Object.entries(projectDirMap)) {
    if (await Promise.any(typeFiles.map(file => doesFileExist(cwd, file)))) {
      detectedTypes.push(projectType)
    }
  }

  const projectDetails = {}
  for (const type of detectedTypes) {
    projectDetails[type] = await scanProjectDir(cwd, type, files)
  }

  const analysis = {
    types: detectedTypes,
    primaryType: detectedTypes[0] || 'unknown',
    files,
    gitInfo,
    details: projectDetails,
  }

  return analysis
}
