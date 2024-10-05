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

export async function getGitInfo(cwd) {
  try {
    const [branch, remoteUrl, status, diff] = await Promise.all([
      execAsync('git rev-parse --abbrev-ref HEAD', { cwd }),
      execAsync('git config --get remote.origin.url', { cwd }),
      execAsync('git status --porcelain', { cwd }),
      execAsync('git diff HEAD', { cwd }),
    ])

    const changes = status.stdout.split('\n').filter(line => line.trim() !== '')

    const detailedChanges = await Promise.all(
      changes.map(async change => {
        const [status, file] = change.trim().split(' ')
        let fileDiff = ''
        if (status !== '??') {
          fileDiff = await execAsync(`git diff HEAD -- "${file}"`, { cwd })
            .then(result => result.stdout)
            .catch(() => '')
        }
        return { status, file, diff: fileDiff }
      }),
    )

    return {
      branch: branch.stdout.trim(),
      remoteUrl: remoteUrl.stdout.trim(),
      changes: detailedChanges,
      fullDiff: diff.stdout,
    }
  } catch (error) {
    console.error('Error getting git info:', error)
    return null
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
    case 'rust':
      const cargoTo = await fs.readFile(path.join(cwd, 'Cargo.toml'), 'utf8')
      return {
        name: cargoTo.match(/name\s*=\s*"(.+)"/)?.[1],
        version: cargoTo.match(/version\s*=\s*"(.+)"/)?.[1],
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
      return {
        moduleName: go.match(/module\s+(.+)/)?.[1],
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

export async function analyzeCwd(cwd) {
  const files = await fs.readdir(cwd)
  const gitInfo = await getGitInfo(cwd)

  let type = 'unknown'
  for (const [projectType, typeFiles] of Object.entries(projectDirMap)) {
    if (await Promise.any(typeFiles.map(file => doesFileExist(cwd, file)))) {
      type = projectType
      break
    }
  }

  const analysis = {
    type,
    files,
    gitInfo,
    details: await scanProjectDir(cwd, type, files),
  }

  return analysis
}
